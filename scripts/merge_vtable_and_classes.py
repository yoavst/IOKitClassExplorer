import json
import sys
import re
from cpp_demangle import demangle

UNKNOWN = "???"


def clean_type_name(type_name: str) -> str:
    """Remove function attributes like __cdecl, __hidden, etc."""
    return re.sub(r"\b(__\w+)\b", "", type_name).strip()


def parse_cpp_signature(signature: str) -> list[str, list[dict]]:
    """Parse C++ function signature into return type and argument list"""
    # Regular expression to extract return type and function signature
    match = re.match(r"([\w\s:*~]+)\s*(__\w+)\s*\((.*)\)", signature)
    if not match:
        return None

    return_type = clean_type_name(match.group(1).strip())  # Clean return type
    args_string = match.group(2).strip()

    args = []
    if args_string and args_string != "void":
        # Split arguments while avoiding commas inside template types or function pointers
        arg_list = re.split(r",(?![^\(]*\))", args_string)

        for arg in arg_list:
            arg = clean_type_name(arg.strip())  # Clean argument type
            parts = arg.rsplit(" ", 1)  # Split type and name
            if len(parts) == 2:
                arg_type, arg_name = parts
            else:
                arg_type, arg_name = parts[0], None  # Handle missing name
            args.append(
                {
                    "name": arg_name.strip() if arg_name else None,
                    "type": arg_type.strip(),
                }
            )

    return return_type, args


def main(args):
    if len(args) != 2:
        print("Usage: merge_vtable_and_classes.py <classes.json> <methods.json>")
        return
    classes_file_name, methods_file_name = args
    with open(classes_file_name) as f:
        classes = json.load(f)
    with open(methods_file_name) as f:
        methods = json.load(f)

    tree = create_tree(classes)
    new_methods = fill_vtable(methods, tree)
    merge(classes, new_methods)
    with open("new_classes.json", "w") as f:
        json.dump(classes, f, indent=2)


def merge(classes, methods):
    for clazz in classes:
        name = clazz["name"]
        new_methods = methods.get(name, None)
        if new_methods:
            clazz["vtable"] = new_methods


def create_tree(classes):
    tree = {}
    for clazz in classes:
        parent = clazz["parent"]
        if parent is not None:
            tree.setdefault(parent, []).append(clazz["name"])

        tree.setdefault(clazz["name"], [])

    return tree


def fill_vtable(all_methods, tree):
    new_methods = dict()

    for class_name, methods in all_methods.items():
        if class_name not in tree:
            continue

        fill_vtable_for_class(methods, tree, class_name, all_methods, new_methods)

    return new_methods


def fill_vtable_for_class(methods, tree, class_name, all_methods, new_methods):
    if class_name in new_methods:
        return

    # print("handling", class_name)
    for child in tree[class_name]:
        if child in all_methods:
            fill_vtable_for_class(
                all_methods[child], tree, child, all_methods, new_methods
            )

    methods_arr = []
    for i, method in enumerate(methods):
        name = method["method_name"]
        is_pure_virtual = name == "___cxa_pure_virtual"

        if is_pure_virtual:
            # Try to check if a child has implementation
            name = f"vmethod{i}"
            for child in tree[class_name]:
                if child not in new_methods:
                    continue
                child_method_name = new_methods[child][i]["name"]
                if child_method_name != name:
                    name = child_method_name
                    break

        return_type, parameters = None, None
        for child in tree[class_name]:
            if child not in new_methods:
                continue
            child_method_type = new_methods[child][i]["returnType"]
            child_method_parameters = new_methods[child][i]["parameters"]
            if child_method_type != UNKNOWN:
                return_type = child_method_type
                parameters = child_method_parameters
                break
        else:
            type = method["type"]
            if type is None:
                return_type, parameters = UNKNOWN, [{"type": UNKNOWN, "name": None}]
            else:
                return_type, parameters = parse_cpp_signature(method["type"])
                parameters = parameters[1:]

        try:
            demangled = demangle(method["mangled_name"])
            is_implemented_by_current_class = demangled.startswith(class_name + "::")
        except ValueError:
            is_implemented_by_current_class = False

        methods_arr.append(
            {
                "vtableIndex": i,
                "parameters": parameters,
                "returnType": return_type,
                "name": name,
                "isPureVirtual": is_pure_virtual,
                "isImplementedByCurrentClass": is_implemented_by_current_class,
            }
        )
    new_methods[class_name] = methods_arr


if __name__ == "__main__":
    main(sys.argv[1:])
