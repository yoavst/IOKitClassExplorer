import dataclasses
import json
from dataclasses import dataclass
from pathlib import Path

from idahelper import cpp, memory, tif

PURE_VIRTUAL_FUNC_NAME = "___cxa_pure_virtual"
UNKNOWN_TYPE = "???"


@dataclass
class MethodParam:
    type: str
    name: str | None = None


@dataclass
class Method:
    name: str
    mangled_name: str
    return_type: str
    parameters: list[MethodParam]
    is_pure_virtual: bool
    is_implemented_by_current_class: bool
    vtable_index: int


def split_function_params(params: str) -> list[str]:
    """Split function parameters."""
    params_arr = []
    inner_level = 0
    start_index = 0
    for i in range(len(params)):
        if params[i] == "(":
            inner_level += 1
        elif params[i] == ")":
            inner_level -= 1
        elif params[i] == "," and inner_level == 0:
            params_arr.append(params[start_index:i].strip())
            start_index = i + 1

    if start_index < len(params):
        params_arr.append(params[start_index:].strip())

    return params_arr


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
        [MethodParam(type=param.strip()) for param in split_function_params(params_str)]
        if params_str
        else []
    )

    if len(param_types) == 1 and param_types[0].type == "void":
        return []

    return param_types


def get_func_types(
    func_addr: int, demangled_name: str | None
) -> tuple[str, list[MethodParam]]:
    """Get the return type and parameters of a function."""
    func_type = tif.from_ea(func_addr)
    if func_type is None:
        # Try to fallback into parsing the function name
        if demangled_name:
            parameters = get_parameter_types_from_demangled_name(demangled_name)
            if parameters is not None:
                return (UNKNOWN_TYPE, parameters)

        # Failed to get the function type, return unknown
        return (UNKNOWN_TYPE, [MethodParam(UNKNOWN_TYPE, None)])

    return_type = func_type.get_rettype().dstr()
    func_data = tif.get_func_details(func_type)
    if func_data is None:
        parameters = [MethodParam(UNKNOWN_TYPE, None)]
    else:
        parameters = []
        for i in range(func_data.size()):
            parameters.append(
                {"name": func_data[i].name, "type": func_data[i].type.dstr()}
            )
        parameters = parameters[1:]  # Remove this argument

    return return_type, parameters


def reset_imports_caching():
    """hack to fix ida-ios-helper caching of imports"""
    memory.imports.cache_clear()


def extract_vtable(type_name: str, vtable_ea: int) -> list[Method] | None:
    """Return list of virtual methods from vtable ea"""
    methods: list[Method] = []
    try:
        for entry in cpp.iterate_vtable(
            vtable_ea, skip_reserved=True, raise_on_error=True
        ):
            class_and_name = cpp.demangle_class_and_name(entry.func_name)
            if class_and_name is None:
                class_name, method_name = None, entry.demangled_func_name
            else:
                class_name, method_name = class_and_name

            return_type, parameters = get_func_types(
                entry.func_ea, entry.demangled_func_name
            )

            methods.append(
                Method(
                    name=method_name,
                    mangled_name=entry.func_name,
                    return_type=return_type,
                    parameters=parameters,
                    vtable_index=entry.index,
                    is_implemented_by_current_class=class_name == type_name,
                    is_pure_virtual=entry.func_name == PURE_VIRTUAL_FUNC_NAME,
                )
            )
    except MemoryError:
        return None
    return methods


def get_methods() -> dict[str, list[Method]]:
    """Returns a mapping of class name to list of methods."""
    reset_imports_caching()
    all_methods = {
        type_name: extract_vtable(type_name, ea)
        for type_name, ea in cpp.iterate_vtables()
    }
    return {k: v for k, v in all_methods.items() if v}


def serialize(data, path: Path):
    """Write data as json to the given path, with support for serializing data classes"""

    class EnhancedJSONEncoder(json.JSONEncoder):
        def default(self, o):
            if dataclasses.is_dataclass(o) and not isinstance(o, type):
                return dataclasses.asdict(o)
            return super().default(o)

    with path.open("w") as f:
        json.dump(data, f, indent=4, cls=EnhancedJSONEncoder)


if __name__ == "__main__":
    methods = get_methods()
    serialize(methods, Path("/tmp/methods.json"))
