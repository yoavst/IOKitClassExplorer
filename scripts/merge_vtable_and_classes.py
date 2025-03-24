import dataclasses
import json
import os
import sys

UNKNOWN = "???"


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if dataclasses.is_dataclass(o):
            return {
                EnhancedJSONEncoder.camelcase(k): v
                for k, v in dataclasses.asdict(o).items()
            }
        return super().default(o)

    @staticmethod
    def camelcase(string):
        if string == "":
            return string

        lst = string.split("_")
        for i in range(len(lst)):
            if i == 0:
                continue
            else:
                lst[i] = lst[i].capitalize()

        return "".join(lst)


@dataclasses.dataclass
class MethodParam:
    type: str
    name: str | None = None

    @classmethod
    def from_dict(cls, data):
        return cls(
            type=data["type"],
            name=data.get("name", None),
        )


@dataclasses.dataclass
class InputMethod:
    name: str
    return_type: str
    parameters: list[MethodParam]
    is_pure_virtual: bool
    is_implemented_by_current_class: bool
    vtable_index: int

    @classmethod
    def from_dict(cls, data):
        return cls(
            name=data["name"],
            return_type=data["return_type"],
            is_pure_virtual=data["is_pure_virtual"],
            is_implemented_by_current_class=data["is_implemented_by_current_class"],
            vtable_index=data["vtable_index"],
            parameters=[MethodParam.from_dict(p) for p in data["parameters"]],
        )


@dataclasses.dataclass
class MethodWithPrototype:
    prototype_index: int
    is_overriden: bool
    is_pure_virtual: bool


@dataclasses.dataclass
class MethodPrototype:
    name: str
    return_type: str
    parameters: list[MethodParam]
    vtable_index: int
    declaring_class: str
    proto_index: int


def main(args):
    if len(args) != 2:
        print("Usage: merge_vtable_and_classes.py folder_of_classes_json")
        return
    classes_file_name, folder_of_classes_json = args
    with open(classes_file_name) as f:
        classes = json.load(f)
    methods: dict[str, list[InputMethod]] = {}
    for methods_file_name in os.listdir(folder_of_classes_json):
        with open(os.path.join(folder_of_classes_json, methods_file_name), "r") as f:
            methods.update(
                {
                    k: [InputMethod.from_dict(m) for m in v]
                    for k, v in json.load(f).items()
                }
            )

    classes_dict = {c["name"]: c for c in classes}
    new_methods, prototypes = collect_prototypes(methods, classes_dict)
    merge(classes, new_methods)
    with open("new_classes.json", "w") as f:
        json.dump(classes, f, indent=4, cls=EnhancedJSONEncoder)
    with open("new_prototypes.json", "w") as f:
        json.dump(prototypes, f, indent=4, cls=EnhancedJSONEncoder)


def merge(classes, methods):
    for clazz in classes:
        name = clazz["name"]
        new_methods = methods.get(name, None)
        if new_methods:
            clazz["vtable"] = new_methods


def collect_prototypes(all_methods: dict[str, list[InputMethod]], classes_dict):
    prototypes = []
    new_methods_with_proto = {}
    for class_name, methods in all_methods.items():
        if class_name not in classes_dict:
            continue

        collect_prototypes_for_class(
            class_name,
            methods,
            prototypes,
            all_methods,
            classes_dict,
            new_methods_with_proto,
        )

    # Fix pure virtual methods
    for prototype in prototypes:
        if prototype.name == "":
            prototype.name = f"vmethod{prototype.vtable_index}"
            prototype.return_type = UNKNOWN
            prototype.parameters = [MethodParam(type=UNKNOWN)]

    return new_methods_with_proto, prototypes


def collect_prototypes_for_class(
    class_name: str,
    methods: list[InputMethod],
    prototypes: list[MethodPrototype],
    all_methods: dict[str, list[InputMethod]],
    classes_dict,
    new_methods_with_proto: dict[str, list[MethodWithPrototype]],
):
    if class_name in new_methods_with_proto:
        return

    clz = classes_dict[class_name]
    while (clz := classes_dict.get(clz["parent"], None)) is not None:
        clz_name = clz["name"]
        if clz_name in all_methods:
            collect_prototypes_for_class(
                clz_name,
                all_methods[clz_name],
                prototypes,
                all_methods,
                classes_dict,
                new_methods_with_proto,
            )

    parent = classes_dict[class_name]["parent"]
    parent_proto_methods = new_methods_with_proto.get(parent, [])

    my_methods = []
    if len(parent_proto_methods) > len(methods):
        print(
            f"Not enough methods for {class_name}. Expected: {len(parent_proto_methods)} has: {len(methods)}"
        )
        return

    for i in range(len(parent_proto_methods)):
        parent_method = parent_proto_methods[i]
        input_method = methods[i]

        my_methods.append(
            MethodWithPrototype(
                parent_method.prototype_index,
                input_method.is_implemented_by_current_class,
                input_method.is_pure_virtual,
            )
        )

        enrich_prototype(
            class_name, prototypes[parent_method.prototype_index], input_method
        )

    # Add new methods' prototypes
    for i in range(len(parent_proto_methods), len(methods)):
        input_method = methods[i]
        prototype = MethodPrototype(
            name="" if input_method.is_pure_virtual else input_method.name,
            return_type=input_method.return_type,
            parameters=input_method.parameters,
            vtable_index=input_method.vtable_index,
            declaring_class=class_name,
            proto_index=len(prototypes),
        )
        prototypes.append(prototype)
        my_methods.append(
            MethodWithPrototype(
                prototype.proto_index,
                input_method.is_implemented_by_current_class,
                input_method.is_pure_virtual,
            )
        )

    new_methods_with_proto[class_name] = my_methods


def enrich_prototype(class_name, prototype, input_method):
    if prototype.return_type == UNKNOWN:
        prototype.return_type = input_method.return_type

    if input_method.is_pure_virtual:
        return
    elif (
        len(prototype.parameters) == 1 and prototype.parameters[0].type == UNKNOWN
    ) or prototype.name == "":
        prototype.parameters = input_method.parameters
        prototype.name = prototype.name or input_method.name
    elif (
        prototype.name != input_method.name
        and not prototype.name.startswith("~")
        and not input_method.name.startswith("sub_")
    ):
        print("Name mismatch:", class_name, prototype, input_method)
        return
    else:
        if len(prototype.parameters) != len(input_method.parameters):
            print("Prototype mismatch:", class_name, prototype, input_method)
            if len(prototype.parameters) < len(input_method.parameters) and not (
                len(prototype.parameters) == 1
                and prototype.parameters[0].type == UNKNOWN
            ):
                print("\t Still updating info")
                prototype.parameters = input_method.parameters
            return

        for proto_param, input_param in zip(
            prototype.parameters, input_method.parameters
        ):
            if proto_param.type == UNKNOWN:
                proto_param.type = input_param.type
            if proto_param.name is None:
                proto_param.name = proto_param.name


if __name__ == "__main__":
    main(sys.argv[1:])
