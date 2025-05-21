import json
import re
import urllib.request
import idautils
import idc
import ida_typeinf
import ida_bytes
import ida_funcs
import ida_name
import idaapi


VTABLE_PREFIX = "`vtable for'"
PTR_SIZE = 8
GENERIC_FUNCTION_TYPE_PATTERN = re.compile(
    r"__int64 \(__fastcall \*\)\((\w+) \*__hidden this\)"
)


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


## TIF (c types in ida) utils


def type_to_tif(c_type: str) -> ida_typeinf.tinfo_t | None:
    tif = ida_typeinf.tinfo_t()
    if c_type == "void":
        tif.create_simple_type(ida_typeinf.BT_VOID)
        return tif
    else:
        if (
            ida_typeinf.parse_decl(
                tif,
                None,
                c_type + ";",
                ida_typeinf.PT_SIL | ida_typeinf.PT_NDC | ida_typeinf.PT_TYP,
            )
            is not None
        ):
            return tif
    return None


def unkown_to_int64(typ: str) -> str:
    return typ if typ != "???" else "__int64"


def func_to_tif(
    class_name: str, return_type: str, parameters
) -> ida_typeinf.tinfo_t | None:
    params_str = f"{class_name} *__hidden this"
    if len(parameters) != 0:
        params_str += ", "
        params_str += ",".join(
            f"{unkown_to_int64(p['type'])} {p.get('name', '')}" for p in parameters
        )
    sig = f"{unkown_to_int64(return_type)} f({params_str})"
    return type_to_tif(sig)


def ptr_to_tif(tif: ida_typeinf.tinfo_t) -> ida_typeinf.tinfo_t:
    new_tif = ida_typeinf.tinfo_t()
    new_tif.create_ptr(tif)
    return new_tif


## vtable types utils


def get_all_vtbl_types() -> dict[str, int]:
    """Retrieve all types that start with `_vtbl` from IDA's type system."""
    vtbl_types = {}

    tli = ida_typeinf.get_idati()
    qty = ida_typeinf.get_ordinal_count(tli)

    for ordinal in range(1, qty + 1):
        type_name = ida_typeinf.get_numbered_type_name(tli, ordinal)
        if type_name and type_name.endswith("_vtbl"):
            vtbl_types[type_name] = ordinal

    return vtbl_types


def remove_rtii_from_vtbl(type_name, type_ord):
    tli = ida_typeinf.get_idati()
    tif = ida_typeinf.tinfo_t()

    if not tif.get_numbered_type(tli, type_ord, ida_typeinf.BTF_STRUCT):
        print(f"Failed to retrieve type information for {type_ord}")
        return

    udt_data = ida_typeinf.udt_type_data_t()
    if not tif.get_udt_details(udt_data):
        print(f"Failed to retrieve UDT details for {type_name}")
        return

    for member in udt_data:
        if not member.type.is_funcptr():
            print(f"Removing {type_name}::{member.name} of size {member.size}")
            tif.del_udm(0)
            tif.expand_udt(1, -(member.size // 8))
        else:
            break


def is_nonchanged_type_method(function_ptr) -> bool:
    return bool(GENERIC_FUNCTION_TYPE_PATTERN.match(str(function_ptr.type)))


def get_ea_type(ea: int) -> ida_typeinf.tinfo_t | None:
    """Get the type of a function at a given address."""
    tif = ida_typeinf.tinfo_t()
    if idaapi.get_tinfo(tif, ea):
        return tif
    return None


def build_type(type_name: str, method, func_ea: int) -> ida_typeinf.tinfo_t | None:
    func_cls_type = type_name if method["isOverriding"] else method["declaringClass"]

    # Try to get the function type from KDK
    func_type = func_to_tif(
        func_cls_type,
        method["returnType"],
        method["parameters"],
    )
    if func_type is not None:
        return func_type

    # Try to get it from the function
    if ida_funcs.get_func(func_ea):
        tif = get_ea_type(func_ea)
        if tif is not None:
            tif.set_funcarg_type(0, type_to_tif(f"{func_cls_type} *"))
            return tif

    # Try to get the right number of parameters at least
    if len(method["parameters"]) != 1 or method["parameters"][0]["type"] != "???":
        return func_to_tif(
            func_cls_type,
            method["returnType"],
            [{"type": "???"}] * len(method["parameters"]),
        )

    return None


def rename_methods(type_name, type_ord, vtable_ea, methods):
    # Verify the type is not buggy
    if methods[0]["name"] != "~OSObject":
        print(f"Type {type_name} is buggy")
        return

    tli = ida_typeinf.get_idati()
    tif = ida_typeinf.tinfo_t()

    if not tif.get_numbered_type(tli, type_ord, ida_typeinf.BTF_STRUCT):
        print(f"Failed to retrieve type information for {type_ord}")
        return

    udt_data = ida_typeinf.udt_type_data_t()
    if not tif.get_udt_details(udt_data):
        print(f"Failed to retrieve UDT details for {type_name}")
        return

    # Skip "this" and "rtii" pointers
    vtable_ea += 2 * PTR_SIZE

    for i, member in enumerate(udt_data):
        assert member.type.is_funcptr()

        # If we recovered only part of the vtable, skip the rest
        if i >= len(methods):
            return
        method = methods[i]

        # Skip destructor
        if "~" in method["name"]:
            continue

        # Rename the member in the vtable type
        vtable_new_name = method["name"]
        rename_udm_with_retry(tif, i, vtable_new_name)

        # Get the function address
        func_ptr_ea = vtable_ea + member.offset // 8
        func_addr = ida_bytes.get_qword(func_ptr_ea)

        # Apply the type to the UDM
        if method["isPureVirtual"]:
            continue

        new_type = build_type(type_name, method, func_addr)

        if new_type is not None and is_nonchanged_type_method(member):
            tif.set_udm_type(i, ptr_to_tif(new_type))

        # Apply the type to the function if it is defined by this class
        if method["declaringClass"] == type_name or method["isOverriding"]:
            if ida_funcs.get_func(func_addr):
                new_name = llvm_mangle(method["name"], type_name)
                ida_name.set_name(func_addr, new_name, ida_name.SN_CHECK)
                if new_type is not None and is_nonchanged_type_method(member):
                    ida_typeinf.apply_tinfo(func_addr, new_type, idaapi.TINFO_DEFINITE)
                print(f"Renamed {hex(func_addr)} -> {new_name}")


def rename_udm_with_retry(tif: ida_typeinf.tinfo_t, udm_index: int, new_name: str):
    suffix = ""
    for j in range(20):
        name = f"{new_name}{suffix}"
        if not tif.rename_udm(udm_index, name):
            break
        suffix = str(j)


## memory vtables utils
def demangle(symbol: str) -> str | None:
    """Demangle cpp symbol."""
    return idc.demangle_name(symbol, idc.get_inf_attr(idc.INF_SHORT_DEMNAMES))


def vtable_symbol_get_class(symbol: str) -> str | None:
    """Get the class name for a vtable symbol."""
    demangled = demangle(symbol)
    if demangled is not None and demangled.startswith(VTABLE_PREFIX):
        return demangled[len(VTABLE_PREFIX) :]
    return None


def get_all_memory_vtables() -> dict[str, int]:
    d = {}
    for ea, name in idautils.Names():
        cls = vtable_symbol_get_class(name)
        if cls is not None:
            d[cls] = ea
    return d


def get_all_vtbls(vtables_types) -> dict[tuple[str, int], int]:
    d = {}
    memory_vtables = get_all_memory_vtables()
    for name, ordinal in vtables_types.items():
        type_name = name.removesuffix("_vtbl")
        vtable = memory_vtables.get(type_name, None)
        if vtable is None:
            print(f"Failed to find vtable for {type_name}")
            continue
        d[(type_name, ordinal)] = vtable
    return d


def search_methods_for_type(prototypes: dict, classes: dict, type_name: str) -> list:
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

    res = []
    for m in cls["vtable"]:
        proto = prototypes[m["prototypeIndex"]]
        is_overriding = check_override and m["isOverriden"]
        res.append(
            {
                **proto,
                "isOverriding": is_overriding,
                "isPureVirtual": m["isPureVirtual"],
            }
        )
    return res


def get_file(name: str) -> str:
    BASE_URL = "https://raw.githubusercontent.com/yoavst/IOKitClassExplorer/refs/heads/main/src/"
    return urllib.request.urlopen(BASE_URL + name).read()


def main():
    prototypes = json.loads(get_file("prototypes.json"))
    classes = json.loads(get_file("classes.json"))
    classes_dict = {cls["name"]: cls for cls in classes}

    vtbl_types = get_all_vtbl_types()
    print("Got all vtable types")
    vtbls = get_all_vtbls(vtbl_types)
    print("got all vtables")
    for i, ((type_name, type_ord), vtable_ea) in enumerate(vtbls.items()):
        print(i, type_name, type_ord, hex(vtable_ea))
        if type_name not in classes_dict:
            continue

        methods = search_methods_for_type(prototypes, classes_dict, type_name)
        if not methods:
            continue

        remove_rtii_from_vtbl(type_name, type_ord)
        rename_methods(
            type_name,
            type_ord,
            vtable_ea,
            methods,
        )


main()
