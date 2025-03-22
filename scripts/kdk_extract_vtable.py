import idautils
import idc
import ida_bytes
import ida_funcs
import json
import dataclasses
import ida_nalt

NULL_PTR = 0
PTR_SIZE = 8


@dataclasses.dataclass
class Method:
    mangled_name: str
    type: str
    method_name: str


def demangle(symbol: str) -> str:
    return idc.demangle_name(symbol, idc.get_inf_attr(idc.INF_SHORT_DEMNAMES))


def vtable_symbol_get_class(symbol: str) -> str | None:
    """Get the class name for a vtable symbol."""
    try:
        pre, post = demangle(symbol).split("`vtable for'", 1)
        assert pre == ""
        return post
    except:
        return None


def get_all_memory_vtables() -> dict[str, int]:
    d = {}
    for ea, name in idautils.Names():
        cls = vtable_symbol_get_class(name)
        if cls is not None and not cls.endswith("::MetaClass"):
            d[cls] = ea
    return d


def get_demangled_method_name(symbol: str) -> str | None:
    demangled = demangle(symbol)
    if demangled is None:
        return symbol
    _, method = demangled.split("::", maxsplit=1)
    return method.split("(")[0]


def get_import_name(ea: int):
    found = []

    def import_callback(ea_: int, name: str, ordinal: int):
        if ea_ == ea:
            found.append(name)
            return None  # Return the import name if found
        return True  # Continue searching

    # Since `get_import_module_qty()` is returning 1, iterate through its imports
    for i in range(ida_nalt.get_import_module_qty()):
        ida_nalt.enum_import_names(i, import_callback)
        if len(found):
            return found[0]

    return None


def extract_vtable(type_name: str, vtbl_ea: int) -> list[Method] | None:
    # Skip the thisOffset and rtti. Both are pointers.
    methods = []
    if ida_bytes.get_qword(vtbl_ea) != NULL_PTR:
        print(f"Imported vtable for {type_name}")
        return None

    current_ea = vtbl_ea + (PTR_SIZE * 2)
    while (func_addr := ida_bytes.get_qword(current_ea)) != NULL_PTR:
        if ida_funcs.get_func(func_addr):
            mangled_name = idc.get_func_name(func_addr)
            method_type = idc.get_type(func_addr)
            method_name = get_demangled_method_name(mangled_name)
            if method_name is not None and not method_name.startswith("_RESERVED"):
                methods.append(
                    Method(
                        mangled_name=mangled_name,
                        type=method_type,
                        method_name=method_name,
                    )
                )
        elif import_name := get_import_name(func_addr):
            method_type = idc.get_type(func_addr)
            method_name = get_demangled_method_name(import_name)
            if method_name is not None and not method_name.startswith("_RESERVED"):
                methods.append(
                    Method(
                        mangled_name=import_name,
                        type=method_type,
                        method_name=method_name,
                    )
                )
        else:
            print(f"Failed to get func for {current_ea} of {vtbl_ea}")
            return None

        current_ea += PTR_SIZE

    return methods


def main():
    vtbls = get_all_memory_vtables()
    all_methods: dict[str, list[str]] = {}
    for type_name, ea in vtbls.items():
        methods = extract_vtable(type_name, ea)
        all_methods[type_name] = methods

    serialize(all_methods)


def serialize(data):
    class EnhancedJSONEncoder(json.JSONEncoder):
        def default(self, o):
            if dataclasses.is_dataclass(o):
                return dataclasses.asdict(o)
            return super().default(o)

    with open("/tmp/methods.json", "w") as f:
        json.dump(data, f, indent=4, cls=EnhancedJSONEncoder)


main()
