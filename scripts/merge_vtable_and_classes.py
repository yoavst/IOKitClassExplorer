import json
import sys

UNKNOWN = "???"


def main(args):
    if len(args) < 2:
        print("Usage: merge_vtable_and_classes.py <classes.json> [<methods.json> ...]")
        return
    classes_file_name = args[0]
    with open(classes_file_name) as f:
        classes = json.load(f)
    methods = {}
    for methods_file_name in args[1:]:
        with open(methods_file_name, "r") as f:
            methods.update(json.load(f))

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

    for child in tree[class_name]:
        if child in all_methods:
            fill_vtable_for_class(
                all_methods[child], tree, child, all_methods, new_methods
            )

    methods_arr = []
    for i, method in enumerate(methods):
        name = method["name"]
        is_pure_virtual = method["is_pure_virtual"]

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

        return_type, parameters = method["return_type"], method["parameters"]
        if is_pure_virtual or return_type == UNKNOWN:
            # Try to check if a child has more details
            for child in tree[class_name]:
                if child not in new_methods:
                    continue
                child_method_type = new_methods[child][i]["returnType"]
                child_method_parameters = new_methods[child][i]["parameters"]
                if child_method_type != UNKNOWN:
                    return_type = child_method_type
                    parameters = child_method_parameters
                    break

        methods_arr.append(
            {
                "vtableIndex": i,
                "parameters": parameters,
                "returnType": return_type,
                "name": name,
                "isPureVirtual": is_pure_virtual,
                "isImplementedByCurrentClass": method[
                    "is_implemented_by_current_class"
                ],
            }
        )
    new_methods[class_name] = methods_arr


if __name__ == "__main__":
    main(sys.argv[1:])
