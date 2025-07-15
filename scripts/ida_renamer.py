import json
import re
import urllib.request
from typing import TypedDict

import ida_funcs
from ida_typeinf import tinfo_t, udm_t
from idahelper import cpp, memory, tif

GENERIC_FUNCTION_TYPE_PATTERN = re.compile(
    r"(__int64|void) \(__fastcall \*\)\((\w+) \*__hidden this\)"
)


# Types of prototypes.json
class Parameter(TypedDict):
    type: str
    name: str


class Prototype(TypedDict):
    name: str
    mangledName: str
    returnType: str
    parameters: list[Parameter]
    vtableIndex: int
    declaringClass: str
    protoIndex: int


# Types of classes.json
class VtableEntry(TypedDict):
    prototypeIndex: int
    isOverriden: bool
    isPureVirtual: bool


class Clazz(TypedDict):
    name: str
    parent: str | None
    isAbstract: bool
    vtable: list[VtableEntry]


# Types of the script
class ExtendedPrototype(Prototype):
    isOverriden: bool
    isPureVirtual: bool


## Mangle utils
def detect_ctor_dtor(name: str, class_name: str):
    """
    Detect if a function name is a constructor or destructor, and determine the variant.

    :param name: Function name (e.g., "MyClass", "~MyClass", "~MyClass_0").
    :param class_name: The class name it belongs to.
    :return: Tuple (is_ctor, dtor_variant, processed_name)
    """
    if name == class_name:
        return True, None, class_name  # Constructor
    elif name.startswith(f"~{class_name}"):
        # Check if it has a suffix (_0, _1, _2)
        match = re.match(rf"~{class_name}_(\d)", name)
        if match:
            dtor_variant = int(match.group(1))  # Extract destructor type (0,1,2)
        else:
            dtor_variant = 1  # Default to Base Destructor
        return False, dtor_variant, class_name  # Remove '~'
    else:
        return False, None, name  # Regular function


def llvm_mangle(name: str, class_name: str | None = None):
    """
    Generate an LLVM Itanium ABI mangled name for a function.

    :param name: Function name (e.g., "myFunction", "operator+").
    :param class_name: Optional class name for member functions.
    :return: Mangled LLVM Itanium ABI name.
    """

    # Detect constructor, destructor type, and clean name
    is_ctor, dtor_variant, clean_name = (
        detect_ctor_dtor(name, class_name) if class_name else (False, None, name)
    )

    if not is_ctor and dtor_variant is None and clean_name == name:
        return f"{class_name}::{name}" if class_name else name

    # Itanium ABI prefix
    mangled = "_Z"

    # Handle member functions inside classes
    if class_name:
        mangled += f"N{len(class_name)}{class_name}"

        if dtor_variant == 0:
            mangled += "D0Ev"  # Deleting Destructor (_ZN<Class>D0Ev)
        elif dtor_variant == 1:
            mangled += "D1Ev"  # Base Destructor (_ZN<Class>D1Ev)
        elif dtor_variant == 2:
            mangled += "D2Ev"  # Complete Destructor (_ZN<Class>D2Ev)
        elif is_ctor:
            mangled += "C1Ev"  # Constructor (_ZN<Class>C1Ev)
        else:
            mangled += f"{len(clean_name)}{clean_name}Ev"

        mangled += "E"  # End of qualified name
    else:
        # Global function
        mangled += f"{len(clean_name)}{clean_name}Ev"

    return mangled


def unkown_to_int64(typ: str) -> str:
    return typ if typ != "???" else "__int64"


def remove_rtii_from_vtbl(cpp_type: tinfo_t):
    """Remove fake rtii fields from start of vtable type"""
    vtable_type = tif.vtable_type_from_type(cpp_type)
    if vtable_type is None:
        print(f"[Error] Failed to find vtable type for {cpp_type}")
        return

    udt_data = tif.get_udt(vtable_type)
    if not udt_data:
        print(f"[Error] Failed to retrieve UDT details for {vtable_type}")
        return

    for member in udt_data:
        if not member.type.is_funcptr():
            print(f"Removing {vtable_type}::{member.name} of size {member.size}")
            vtable_type.del_udm(0)
            vtable_type.expand_udt(1, -(member.size // 8))
        else:
            break


def is_nonchanged_type_method(function_ptr) -> bool:
    return bool(GENERIC_FUNCTION_TYPE_PATTERN.match(str(function_ptr.type)))


def build_type(
    type_name: str, proto: ExtendedPrototype, func_ea: int
) -> tinfo_t | None:
    func_cls_type = type_name if proto["isOverriden"] else proto["declaringClass"]
    func_cls_tif = tif.from_struct_name(func_cls_type)

    # Try to get the function type from KDK
    func_type = tif.from_func_components(
        proto["returnType"],
        [tif.FuncParam(f"{func_cls_type}*", "this")]
        + [
            tif.FuncParam(type=unkown_to_int64(p["type"]), name=p["name"])
            for p in proto["parameters"]
        ],
    )

    if func_type is not None:
        return func_type

    # Try to get it from the function
    func = ida_funcs.get_func(func_ea)
    if func is not None:
        func_type = tif.from_func(func)
        if func_type is not None and func_cls_tif is not None:
            func_type.set_funcarg_type(0, tif.pointer_of(func_cls_tif))
            return func_type

    # Try to get the right number of parameters at least
    if len(proto["parameters"]) != 1 or proto["parameters"][0]["type"] != "???":
        return tif.from_func_components(
            proto["returnType"],
            [tif.FuncParam(f"{func_cls_type}*", "this")]
            + ([tif.FuncParam(type="__int64")] * len(proto["parameters"])),
        )
    return None


def rename_methods(cpp_type: tinfo_t, vtable_ea: int, methods: list[ExtendedPrototype]):
    # Verify the type is not buggy
    if methods[0]["name"] != "~OSObject":
        print(f"[Error] Type {cpp_type} is buggy")
        return

    vtable_type = tif.vtable_type_from_type(cpp_type)
    if vtable_type is None:
        print(f"[Error] Failed to find vtable type for {cpp_type}")
        return

    udt_data = tif.get_udt(vtable_type)
    if udt_data is None:
        print(f"Failed to retrieve UDT details for {cpp_type}")
        return

    for entry in cpp.iterate_vtable(vtable_ea):
        # If we recovered only part of the vtable, skip the rest
        if entry.index >= len(methods):
            return
        method = methods[entry.index]

        member = udt_data[entry.index]
        if not member.type.is_funcptr():
            print(f"[Warning] Member type is not function ptr: {cpp_type} {entry}")

        # Skip destructor
        if "~" in method["name"]:
            continue

        # Rename the member in the vtable type
        vtable_new_name = method["name"]
        rename_udm_with_retry(vtable_type, member, vtable_new_name)

        # Apply the type to the UDM
        if method["isPureVirtual"]:
            continue

        new_type = build_type(str(cpp_type), method, entry.func_ea)

        should_apply_type = is_nonchanged_type_method(member)
        if new_type is not None and should_apply_type:
            tif.set_udm_type(vtable_type, member, tif.pointer_of(new_type))

        # Apply the type to the function if it is defined by this class
        if method["declaringClass"] == str(cpp_type) or method["isOverriden"]:
            if ida_funcs.get_func(entry.func_ea):
                if "~" in method["mangledName"]:
                    new_name = llvm_mangle(method["name"], str(cpp_type))
                else:
                    new_name = method["mangledName"]
                memory.set_name(entry.func_ea, new_name)
                if new_type is not None and should_apply_type:
                    tif.apply_tinfo_to_ea(new_type, entry.func_ea)
                print(f"Renamed {entry.func_ea:X} -> {new_name}")


def rename_udm_with_retry(typ: tinfo_t, udm: udm_t, new_name: str):
    suffix = ""
    for j in range(20):
        name = f"{new_name}{suffix}"
        if tif.set_udm_name(typ, udm, name):
            break
        suffix = str(j)


## memory vtables utils


def search_methods_for_type(
    prototypes: list[Prototype], classes: dict, type_name: str
) -> list[ExtendedPrototype]:
    # searching for the first class in the hirarchy chaing that it's vtable is not none
    cls = classes[type_name]
    check_override = True
    while cls.get("vtable") is None:
        check_override = False
        parent = cls.get("parent")
        if parent is None:
            print(f"Could not find methods for {type_name}")
            return []
        cls = classes[parent]

    res: list[ExtendedPrototype] = []
    for m in cls["vtable"]:
        proto: Prototype = prototypes[m["prototypeIndex"]]
        is_overriden = check_override and m["isOverriden"]
        res.append(
            {
                **proto,
                "isOverriden": is_overriden,
                "isPureVirtual": m["isPureVirtual"],
            }  # pyright: ignore[reportArgumentType]
        )
    return res


def get_file(name: str) -> str:
    BASE_URL = "https://raw.githubusercontent.com/yoavst/IOKitClassExplorer/refs/heads/main/src/"
    return urllib.request.urlopen(BASE_URL + name).read()


def main():
    prototypes: list[Prototype] = json.loads(get_file("prototypes.json"))
    classes: list[Clazz] = json.loads(get_file("classes.json"))
    classes_dict: dict[str, Clazz] = {cls["name"]: cls for cls in classes}

    for i, (cpp_type, vtable_ea) in enumerate(cpp.get_all_cpp_classes()):
        print(f"{i}. {cpp_type} at {vtable_ea:X}")
        type_name = str(cpp_type)
        if type_name not in classes_dict:
            continue

        methods = search_methods_for_type(prototypes, classes_dict, type_name)
        if not methods:
            continue

        remove_rtii_from_vtbl(cpp_type)
        rename_methods(cpp_type, vtable_ea, methods)


main()
