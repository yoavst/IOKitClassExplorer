import dataclasses
import json
from pathlib import Path
import sys

UNKNOWN = "???"


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if dataclasses.is_dataclass(o):
            return {
                EnhancedJSONEncoder.camelcase(k): v
                for k, v in EnhancedJSONEncoder.asdict_shallow(o).items()
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
    
    @staticmethod
    def asdict_shallow(obj):
        if not dataclasses.is_dataclass(obj):
            raise TypeError("asdict_shallow() should be called on dataclass instances")
        return {f.name: getattr(obj, f.name) for f in dataclasses.fields(obj)}



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

@dataclasses.dataclass
class ClassInfo:
    name: str
    parent: str | None
    is_abstract: bool
    vtable: list[MethodWithPrototype] | None = None

    @classmethod
    def from_dict(cls, data):
        return cls(
            name=data["name"],
            parent=data.get("parent", None),
            is_abstract=data["isAbstract"]
        )


def main(args):
    if len(args) != 2:
        print("Usage: merge_vtable_and_classes.py classes.json folder_of_classes_json")
        return
    classes_file_name, folder_of_classes_json = args
    with open(classes_file_name) as f:
        classes = [ClassInfo.from_dict(cls) for cls in json.load(f)]

    methods: dict[str, list[InputMethod]] = {}   # class_name -> vtable methods
    for methods_file_name in Path(folder_of_classes_json).glob('*'):    
        with methods_file_name.open("r") as f:
            methods.update(
                {
                    class_name: [InputMethod.from_dict(m) for m in list_methods]
                    for class_name, list_methods in json.load(f).items()
                }
            )

    new_methods, prototypes = collect_prototypes(methods, classes)
    merge(classes, new_methods)
    with open("new_classes.json", "w") as f:
        json.dump(classes, f, indent=4, cls=EnhancedJSONEncoder)
    with open("new_prototypes.json", "w") as f:
        json.dump(prototypes, f, indent=4, cls=EnhancedJSONEncoder)


def merge(classes: list[ClassInfo], methods: dict[str, list[MethodWithPrototype]]):
    for clazz in classes:
        new_methods = methods.get(clazz.name, None)
        if new_methods:
            clazz.vtable = new_methods


def collect_prototypes(all_methods: dict[str, list[InputMethod]], classes: list[ClassInfo]) -> dict[str, list[MethodWithPrototype]]:
    classes_dict = {c.name: c for c in classes} # class_name -> class
    prototypes = []
    new_methods_with_proto = {} # class_name -> vtable based on prototypes
    for class_name, methods in all_methods.items():
        if class_name not in classes_dict:
            print('Class not in classes json', class_name)
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
    classes_dict: dict[str, ClassInfo],
    new_methods_with_proto: dict[str, list[MethodWithPrototype]],
):
    # If already run, don't run again.
    if class_name in new_methods_with_proto:
        return
    
    # For each parent, collect its prototypes.
    my_class = classes_dict[class_name]

    clz = my_class
    while (clz := classes_dict.get(clz.parent, None)) is not None:
        if clz.name in all_methods:
            collect_prototypes_for_class(
                clz.name,
                all_methods[clz.name],
                prototypes,
                all_methods,
                classes_dict,
                new_methods_with_proto,
            )

    parent = my_class.parent
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
