import idautils
import idc
import ida_bytes
import ida_funcs
import json
import dataclasses
import ida_nalt
import ida_typeinf

NULL_PTR = 0
PTR_SIZE = 8
PURE_VIRTUAL_FUNC_NAME = "___cxa_pure_virtual"
VTABLE_PREFIX = "`vtable for'"
UNKNOWN_TYPE = "???"


@dataclasses.dataclass
class MethodParam:
    type: str
    name: str | None = None


@dataclasses.dataclass
class Method:
    name: str
    return_type: str
    parameters: list[MethodParam]
    is_pure_virtual: bool
    is_implemented_by_current_class: bool
    vtable_index: int


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
    """Get all vtables in memory."""
    d = {}
    for ea, name in idautils.Names():
        cls = vtable_symbol_get_class(name)
        if cls is not None and not cls.endswith("::MetaClass"):
            d[cls] = ea
    return d


def get_demangled_class_method_name(symbol: str) -> tuple[str, str] | None:
    """Return the class and method name from a demangled symbol."""
    demangled = demangle(symbol)
    if demangled is None:
        return None, symbol
    cls, method = demangled.split("::", maxsplit=1)
    return cls, method.split("(")[0]


def get_parameter_types_from_demangled_name(
    demangled_name: str,
) -> list[MethodParam] | None:
    if not demangled_name:
        return None

    # The demangled name looks like: "int __cdecl myFunc(int, char, double)"
    open_paren = demangled_name.find("(")
    close_paren = demangled_name.rfind(")")

    if open_paren == -1 or close_paren == -1:
        return None

    params_str = demangled_name[open_paren + 1 : close_paren]
    param_types = (
        [MethodParam(type=param.strip()) for param in params_str.split(",")]
        if params_str
        else []
    )

    return param_types


all_imports = None


def get_all_imports():
    global all_imports
    if all_imports is not None:
        return all_imports

    all_imports = {}
    for i in range(ida_nalt.get_import_module_qty()):

        def import_callback(ea: int, name: str, ordinal: int):
            all_imports[ea] = name
            return True

        ida_nalt.enum_import_names(i, import_callback)
    return all_imports


def get_import_name(ea: int) -> str | None:
    """If the ea is an import, return its name."""
    return get_all_imports().get(ea, None)


def get_func_types(func_addr: int, mangled_name: str) -> tuple[str, list[MethodParam]]:
    """Get the return type and parameters of a function."""
    tif = ida_typeinf.tinfo_t()
    if not ida_nalt.get_tinfo(tif, func_addr):
        # Try to fallback into parsing the function name
        demangled_name = demangle(mangled_name)
        if demangled_name:
            parameters = get_parameter_types_from_demangled_name(demangled_name)
            if parameters is not None:
                return [UNKNOWN_TYPE, parameters]

        # Failed to get the function type, return unknown
        return [UNKNOWN_TYPE, [MethodParam(UNKNOWN_TYPE, None)]]

    return_type = tif.get_rettype().dstr()

    func_data = ida_typeinf.func_type_data_t()
    if not tif.get_func_details(func_data):
        parameters = [MethodParam(UNKNOWN_TYPE, None)]
    else:
        parameters = []
        for i in range(func_data.size()):
            parameters.append(
                {"name": func_data[i].name, "type": func_data[i].type.dstr()}
            )
        parameters = parameters[1:]  # Remove this argument

    return return_type, parameters


def extract_vtable(type_name: str, vtbl_ea: int) -> list[Method] | None:
    """Return list of virtual methods from vtable ea"""
    # Skip the thisOffset and rtti. Both are pointers.
    methods = []
    if ida_bytes.get_qword(vtbl_ea) != NULL_PTR:
        print(f"Imported vtable for {type_name}")
        return None

    current_ea = vtbl_ea + (PTR_SIZE * 2)
    i = 0
    while (func_addr := ida_bytes.get_qword(current_ea)) != NULL_PTR:
        if ida_funcs.get_func(func_addr):
            mangled_name = idc.get_func_name(func_addr)
        elif not (mangled_name := get_import_name(func_addr)):
            print(f"Failed to get func for {current_ea} of {vtbl_ea}")
            return None

        class_name, method_name = get_demangled_class_method_name(mangled_name)
        return_type, parameters = get_func_types(func_addr, mangled_name)

        if method_name is not None and not method_name.startswith("_RESERVED"):
            methods.append(
                Method(
                    name=method_name,
                    return_type=return_type,
                    parameters=parameters,
                    vtable_index=i,
                    is_implemented_by_current_class=class_name == type_name,
                    is_pure_virtual=mangled_name == PURE_VIRTUAL_FUNC_NAME,
                )
            )
            i += 1

        current_ea += PTR_SIZE

    return methods


def main():
    vtbls = get_all_memory_vtables()
    all_methods = {
        type_name: extract_vtable(type_name, ea) for type_name, ea in vtbls.items()
    }
    all_methods = {k: v for k, v in all_methods.items() if v is not None}

    serialize(all_methods)


def serialize(data):
    class EnhancedJSONEncoder(json.JSONEncoder):
        def default(self, o):
            if dataclasses.is_dataclass(o):
                return dataclasses.asdict(o)
            return super().default(o)

    with open(r"/tmp/methods.json", "w") as f:
        json.dump(data, f, indent=4, cls=EnhancedJSONEncoder)


main()
