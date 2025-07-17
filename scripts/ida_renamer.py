import json
import re
import urllib.request
from typing import TypedDict

import ida_funcs
from ida_typeinf import tinfo_t, udm_t, udt_type_data_t
from idahelper import cpp, functions, memory, strings, tif, xrefs

GENERIC_FUNCTION_TYPE_PATTERN = re.compile(r"(__int64|void) \(__fastcall \*\)\((\w+) \*__hidden this\)")


# region Types of prototypes.json
class Parameter(TypedDict):
    """Function parameter type from prototypes.json"""

    type: str
    name: str


class Prototype(TypedDict):
    """Function prototype type from prototypes.json"""

    name: str
    mangledName: str
    returnType: str
    parameters: list[Parameter]
    vtableIndex: int
    declaringClass: str
    protoIndex: int


# endregion


# region Types of classes.json
class VtableEntry(TypedDict):
    prototypeIndex: int
    isOverridden: bool
    isPureVirtual: bool


class Clazz(TypedDict):
    name: str
    parent: str | None
    isAbstract: bool
    vtable: list[VtableEntry]


# endregion


def unknown_to_int64(typ: str) -> str:
    """Convert an unknown type (???) to a known type, defaulting to __int64."""
    return typ if typ != "???" else "__int64"


def _pure_virtual_function_ea() -> int:
    """Locate __cxa_pure_virtual function. Return its start ea"""
    # Try to find the pure virtual function by its name
    pure_virtual_ea = (
        memory.ea_from_name("___cxa_pure_virtual")
        or memory.ea_from_name("__cxa_pure_virtual")
        or memory.ea_from_name("_cxa_pure_virtual")
    )
    if pure_virtual_ea is not None:
        return pure_virtual_ea

    # Find the pure virtual function by its string reference
    pure_virtual_str = strings.find_str("__cxa_pure_virtual")
    pure_virtual_func_ea = next(iter(xrefs.func_xrefs_to(pure_virtual_str.ea)))
    assert pure_virtual_func_ea is not None
    return pure_virtual_func_ea


pure_virtual_function_ea = _pure_virtual_function_ea()


class ClassVtableRenamer:
    def __init__(self, class_type: tinfo_t, vtable_ea: int, is_verbose: bool = True, force_apply: bool = False):
        self.class_type: tinfo_t = class_type
        self.vtable_ea: int = vtable_ea
        self.is_verbose = is_verbose
        self.force_apply = force_apply
        self.vtable_type: tinfo_t = tif.vtable_type_from_type(class_type)
        self.vtable_type_udt: udt_type_data_t = tif.get_udt(self.vtable_type)

        parent_class_type = tif.get_parent_class(self.class_type)
        if parent_class_type is not None:
            self.parent_vtable_size = cpp.vtable_methods_count(parent_class_type, False) * memory.PTR_SIZE
            self.parent_class_vtable_ea = cpp.vtable_location_from_type(parent_class_type)
        else:
            self.parent_vtable_size = 0
            self.parent_class_vtable_ea = None

    def is_override(self, vtable_offset: int) -> bool:
        """Check if the vtable offset is an override of a parent class method."""
        # If no parent or the vtable offset is more than the size of the parent vtable, it is an override
        if self.parent_class_vtable_ea is None or self.parent_vtable_size <= vtable_offset:
            return True

        # It is an override if the vtable entry in the parent class is different from this class
        self_vtable_entry = self.vtable_ea + vtable_offset
        parent_vtable_entry = self.parent_class_vtable_ea + vtable_offset
        return memory.qword_from_ea(parent_vtable_entry) != memory.qword_from_ea(self_vtable_entry)

    def remove_rtti_from_vtable(self):
        """Remove fake rtti fields from start of a vtable type"""
        for member in self.vtable_type_udt:
            if member.type.is_funcptr():
                break

            if self.is_verbose:
                print(f"Removing {self.vtable_type}::{member.name} of size {member.size}")
            # Remove the member from the vtable type
            self.vtable_type.del_udm(0)
            # Remove the newly created gap in the vtable type
            self.vtable_type.expand_udt(1, -(member.size // 8))

    def apply(self, methods: list[Prototype]):
        # Verify the type is not buggy
        if methods[0]["name"] != "~OSObject":
            print(f"[Error] Type {self.class_type} has unexpected first method: {methods[0]['name']}")
            return

        for entry in cpp.iterate_vtable(self.vtable_ea):
            if entry.index < len(methods):
                self._rename_method(entry, methods[entry.index])
            else:
                self._rename_unknown(entry)

    def _rename_method(self, entry: cpp.VTableItem, prototype: Prototype):
        vtable_type_member = self.vtable_type_udt[entry.index]
        if not vtable_type_member.type.is_funcptr():
            print(f"[Warning] Member type is not function ptr: {self.class_type} {entry}")
        # Skip destructor
        if "~" in prototype["name"]:
            return

        # Rename the vtable member
        vtable_new_name = prototype["name"]
        rename_udm_with_retry(self.vtable_type, vtable_type_member, vtable_new_name)

        # Retype the vtable member
        func_type = self._build_func_type(self.class_type, prototype, entry.func_ea)
        if self.force_apply or (is_default_vtable_method_type(vtable_type_member.type) and func_type is not None):
            tif.set_udm_type(self.vtable_type, vtable_type_member, tif.pointer_of(func_type))

        # Only touch the function itself if it is an override or defined by this class
        if (
            not self.is_override(entry.vtable_offset)
            or not functions.is_in_function(entry.func_ea)
            or entry.func_ea == pure_virtual_function_ea
        ):
            return

        # Rename the function
        name = prototype["mangledName"]
        if not name or not self._is_valid_this_class_method(name):
            # Probably because the mangled name is of the original vtable slot
            name = f"{self.class_type}::{prototype['name']}"

        memory.set_name(entry.func_ea, name, retry=True)

        # Retype the function
        func_current_type = tif.from_ea(entry.func_ea)
        if func_type is not None and (
            self.force_apply
            or func_current_type is None
            or is_default_vtable_method_type(tif.pointer_of(func_current_type))
        ):
            tif.apply_tinfo_to_ea(func_type, entry.func_ea)

        if self.is_verbose:
            print(f"Renamed {entry.func_ea:X} ({memory.name_from_ea(entry.func_ea)}) -> {name}")

    def _rename_unknown(self, entry: cpp.VTableItem):
        """Rename a vtable member that we don't know its name or type."""

        # Rename the member in the vtable type
        vtable_new_name = f"vmethod_{entry.index}"
        tif.set_udm_name(self.vtable_type, self.vtable_type_udt[entry.index], vtable_new_name)

        # Don't rename pure virtual functions or functions that are not overrides or non functions
        if (
            entry.func_ea == pure_virtual_function_ea
            or not self.is_override(entry.vtable_offset)
            or not functions.is_in_function(entry.func_ea)
        ):
            return

        if not self._is_valid_this_class_method(memory.name_from_ea(entry.func_ea) or ""):
            func_new_new_name = f"{self.class_type}::{vtable_new_name}"
            memory.set_name(entry.func_ea, func_new_new_name)
            if self.is_verbose:
                print(f"Renamed {entry.func_ea:X} ({memory.name_from_ea(entry.func_ea)}) -> {vtable_new_name}")

    def _is_valid_this_class_method(self, current_name: str) -> bool:
        """
        While we might not know the name of the method, it might have been renamed by the user / other scripts.
        All we need to make sure is that the name is of the form `{self.class_type}::?`.
        Since we only rename on overrides, we will visit any possible method in the vtable with the right class to check this.
        """
        demangled_cpp_class = cpp.demangle_class_only(current_name)
        return demangled_cpp_class == str(self.class_type)

    @staticmethod
    def _build_func_type(class_type: tinfo_t, proto: Prototype, func_ea: int) -> tinfo_t | None:
        """Build a function type from the prototype and type of this parameter."""
        # Try to get the function type from KDK
        func_type = tif.from_func_components(
            unknown_to_int64(proto["returnType"]),
            [tif.FuncParam(f"{class_type}*", "this")]
            + [tif.FuncParam(type=unknown_to_int64(p["type"]), name=p["name"]) for p in proto["parameters"]],
        )

        if func_type is not None:
            return func_type

        # Try to get it from the function
        func = ida_funcs.get_func(func_ea)
        if func is not None:
            func_type = tif.from_func(func)
            if func_type is not None and class_type is not None:
                func_type.set_funcarg_type(0, tif.pointer_of(class_type))
                return func_type

        # Try to get the right number of parameters at least
        if len(proto["parameters"]) != 1 or proto["parameters"][0]["type"] != "???":
            return tif.from_func_components(
                unknown_to_int64(proto["returnType"]),
                [tif.FuncParam(f"{class_type}*", "this")]
                + ([tif.FuncParam(type="__int64")] * len(proto["parameters"])),
            )
        return None


def is_default_vtable_method_type(typ: tinfo_t) -> bool:
    """Is this the default type for a vtable method?"""
    return bool(GENERIC_FUNCTION_TYPE_PATTERN.match(str(typ)))


def rename_udm_with_retry(typ: tinfo_t, udm: udm_t, new_name: str):
    """Rename an udm. On failure, retry with a suffix."""
    suffix = ""
    for j in range(20):
        name = f"{new_name}{suffix}"
        if tif.set_udm_name(typ, udm, name):
            break
        suffix = str(j)


## memory vtables utils
def get_methods_for_type(prototypes: list[Prototype], classes: dict[str, Clazz], type_name: str) -> list[Prototype]:
    # search for the first class in the hierarchy chain that it's vtable is not none
    cls = classes[type_name]
    while cls.get("vtable") is None:
        parent = cls.get("parent")
        if parent is None:
            print(f"Could not find methods for {type_name}")
            return []
        cls = classes[parent]

    return [prototypes[m["prototypeIndex"]] for m in cls["vtable"]]


def get_file(name: str) -> str:
    """Given a filename, retrieve it. Override it if you want to use local files instead."""
    url = f"https://raw.githubusercontent.com/yoavst/IOKitClassExplorer/refs/heads/main/src/{name}"
    return urllib.request.urlopen(url).read()  # noqa: S310


def main(is_verbose: bool, show_progress: bool, force_apply: bool):
    prototypes: list[Prototype] = json.loads(get_file("prototypes.json"))
    classes: list[Clazz] = json.loads(get_file("classes.json"))
    classes_dict: dict[str, Clazz] = {cls["name"]: cls for cls in classes}

    for i, (cpp_type, vtable_ea) in enumerate(cpp.get_all_cpp_classes()):
        if show_progress:
            print(f"{i}. {cpp_type} at {vtable_ea:X}")
        type_name = str(cpp_type)
        if type_name not in classes_dict:
            continue

        methods = get_methods_for_type(prototypes, classes_dict, type_name)
        if not methods:
            continue

        renamer = ClassVtableRenamer(cpp_type, vtable_ea, is_verbose, force_apply)
        renamer.remove_rtti_from_vtable()
        renamer.apply(methods)


main(is_verbose=False, show_progress=True, force_apply=False)
