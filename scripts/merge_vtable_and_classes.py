import abc
import dataclasses
import json
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

UNKNOWN = "???"
FUNC_PREFIX_UNKNOWN = "sub_"


# Region json encoding
class CustomToJson(abc.ABC):
    @abc.abstractmethod
    def to_json(self) -> object:
        """Convert the object to a JSON compatible type."""


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, CustomToJson):
            return o.to_json()
        elif dataclasses.is_dataclass(o):
            return {EnhancedJSONEncoder.camelcase(k): v for k, v in EnhancedJSONEncoder.asdict_shallow(o).items()}
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
        return {f.name: getattr(obj, f.name) for f in dataclasses.fields(obj) if not f.name.startswith("_")}


# endregion


# region input file json structures
@dataclass
class MethodParam:
    type: str
    name: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "MethodParam":
        return cls(
            type=data["type"],
            name=data.get("name"),
        )


@dataclass
class InputMethod:
    name: str
    mangled_name: str
    return_type: str
    parameters: list[MethodParam]
    is_pure_virtual: bool
    is_implemented_by_current_class: bool
    vtable_index: int

    @classmethod
    def from_dict(cls, data: dict) -> "InputMethod":
        name = data["name"]
        mangled_name = data["mangled_name"]
        return cls(
            name="" if name.startswith(FUNC_PREFIX_UNKNOWN) else name,
            mangled_name="" if mangled_name.startswith(FUNC_PREFIX_UNKNOWN) else mangled_name,
            return_type=data["return_type"],
            is_pure_virtual=data["is_pure_virtual"],
            is_implemented_by_current_class=data["is_implemented_by_current_class"],
            vtable_index=data["vtable_index"],
            parameters=[MethodParam.from_dict(p) for p in data["parameters"]],
        )


# endregion


# region output file json structures
@dataclass
class MethodWithPrototype(CustomToJson):
    prototype_index: int
    is_overridden: bool
    is_pure_virtual: bool
    mangled_name: str | None

    def to_json(self) -> object:
        return [self.prototype_index, self.is_overridden, self.is_pure_virtual, self.mangled_name]


@dataclass
class MethodPrototype:
    name: str
    mangled_name: str
    return_type: str
    parameters: list[MethodParam]
    vtable_index: int
    declaring_class: str
    proto_index: int


@dataclass
class ClassInfo:
    name: str
    parent: str | None
    is_abstract: bool
    vtable: list[MethodWithPrototype] | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "ClassInfo":
        return cls(
            name=data["name"],
            parent=data.get("parent"),
            is_abstract=data["is_abstract"],
        )

    def __hash__(self):
        return hash(self.name)

    def __eq__(self, other):
        return isinstance(other, ClassInfo) and self.name == other.name


# endregion

type ClassNameToVtable = dict[str, list[MethodWithPrototype]]


def main(args):
    if len(args) != 2:
        print("Usage: merge_vtable_and_classes.py classes.json folder_of_methods_json")
        return
    classes_file_name, folder_of_methods = args

    # Load classes from the provided JSON file
    with open(classes_file_name) as f:
        classes = [ClassInfo.from_dict(cls) for cls in json.load(f)]
    classes_dict = {c.name: c for c in classes}

    # Load input methods from the provided folder
    input_methods: dict[str, list[InputMethod]] = {}  # class_name -> vtable methods
    for methods_file_name in Path(folder_of_methods).glob("*"):
        with methods_file_name.open("r") as f:
            input_methods.update(
                {
                    class_name: [InputMethod.from_dict(m) for m in list_methods]
                    for class_name, list_methods in json.load(f).items()
                    if class_name in classes_dict
                }
            )

    # Merge vtables
    new_methods, prototypes = collect_prototypes(input_methods, classes_dict)
    fix_getters(prototypes)
    write_vtables_to_classes(classes, new_methods)

    # Serialize the results to JSON files
    with open("../src/classes.json", "w") as f:
        json.dump(classes, f, cls=EnhancedJSONEncoder)
    with open("../src/prototypes.json", "w") as f:
        json.dump(prototypes, f, cls=EnhancedJSONEncoder)


def write_vtables_to_classes(classes: list[ClassInfo], methods: ClassNameToVtable):
    for clazz in classes:
        new_methods = methods.get(clazz.name, None)
        if new_methods:
            clazz.vtable = new_methods


def fix_getters(prototypes: list[MethodPrototype]):
    for prototype in prototypes:
        if prototype.name.startswith("get") and prototype.return_type == "void":
            print(f"Fixed getter for {prototype}")
            prototype.return_type = "???"


def collect_prototypes(
    class_to_input_methods: dict[str, list[InputMethod]], classes: dict[str, ClassInfo]
) -> tuple[ClassNameToVtable, list[MethodPrototype]]:
    prototypes: list[MethodPrototype] = []
    class_to_vtable: ClassNameToVtable = {}

    def handle_class(class_info: ClassInfo):
        if class_info.name not in class_to_input_methods:
            print("Class not in input methods json", class_info.name)
            return

        class_vtable = collect_prototypes_for_class(
            class_info,
            class_to_input_methods[class_info.name],
            prototypes,
            class_to_vtable.get(class_info.parent or "", []),
        )
        if class_vtable is not None:
            class_to_vtable[class_info.name] = class_vtable

    dfs_classes(classes, handle_class)

    fix_pure_virtual_methods(prototypes)
    return class_to_vtable, prototypes


def fix_pure_virtual_methods(prototypes: list[MethodPrototype]):
    """If some methods left without a name (came from pure virtual methods), add a fake name and type."""
    for prototype in prototypes:
        if prototype.name == "":
            prototype.name = f"vmethod{prototype.vtable_index}"
            prototype.mangled_name = f"{prototype.declaring_class}::{prototype.name}"
            prototype.return_type = UNKNOWN
            prototype.parameters = [MethodParam(type=UNKNOWN)]


def dfs_classes(classes: dict[str, ClassInfo], callback: Callable[[ClassInfo], None]):
    """
    Depth-first search through the class hierarchy, calling `callback` for each class.
    Callback for class is only called after all its parents were called.
    """

    visited: set[ClassInfo] = set()

    def dfs(cls: ClassInfo):
        if cls in visited:
            return
        visited.add(cls)

        if cls.parent:
            dfs(classes[cls.parent])
        callback(cls)

    for clazz in classes.values():
        dfs(clazz)


def collect_prototypes_for_class(
    class_info: ClassInfo,
    methods: list[InputMethod],
    prototypes: list[MethodPrototype],
    parent_vtable: list[MethodWithPrototype],
) -> list[MethodWithPrototype] | None:
    class_name = class_info.name
    my_methods: list[MethodWithPrototype] = []

    if len(parent_vtable) > len(methods):
        print(f"Not enough methods for {class_name}. Expected: {len(parent_vtable)} has: {len(methods)}")
        return None

    # Collect and enrich parent methods' prototypes
    for parent_method, input_method in zip(parent_vtable, methods, strict=False):
        my_methods.append(
            MethodWithPrototype(
                parent_method.prototype_index,
                input_method.is_implemented_by_current_class,
                input_method.is_pure_virtual,
                input_method.mangled_name
                if not input_method.is_pure_virtual and input_method.is_implemented_by_current_class
                else None,
            )
        )

        enrich_prototype(class_name, prototypes[parent_method.prototype_index], input_method)

    # Add new methods' prototypes
    for i in range(len(parent_vtable), len(methods)):
        input_method = methods[i]
        if input_method.is_pure_virtual:
            prototype = MethodPrototype(
                name="",
                mangled_name="",
                return_type=UNKNOWN,
                parameters=[MethodParam(type=UNKNOWN)],
                vtable_index=input_method.vtable_index,
                declaring_class=class_name,
                proto_index=len(prototypes),
            )
        else:
            prototype = MethodPrototype(
                name=input_method.name,
                mangled_name=input_method.mangled_name,
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
                input_method.mangled_name
                if not input_method.is_pure_virtual and input_method.is_implemented_by_current_class
                else None,
            )
        )

    return my_methods


def enrich_prototype(class_name: str, prototype: MethodPrototype, input_method: InputMethod):
    # Pure virtual method does not have any details we can use
    if input_method.is_pure_virtual:
        return

    # If we don't know the return type, we can use the input method's return type.
    if prototype.return_type == UNKNOWN:
        prototype.return_type = input_method.return_type

    # If we were defined by pure virtual method, we can use the override method's name and mangled name.
    if not prototype.name:
        prototype.name = prototype.name or input_method.name
        prototype.mangled_name = prototype.mangled_name or input_method.mangled_name
    # Check if the prototype name matches the input method name.
    elif (
        prototype.name != input_method.name
        and not prototype.name.startswith("~")
        and not input_method.name.startswith(FUNC_PREFIX_UNKNOWN)
    ):
        print(f"[Error] Name mismatch on {class_name}: \n\t{prototype}\n\t{input_method}")
        return

    enrich_parameters(class_name, prototype, input_method)


def enrich_parameters(class_name: str, prototype: MethodPrototype, input_method: InputMethod):
    """Enrich the parameters of the prototype with the input method's parameters."""

    # If we have unknown parameters, we can use the input method's parameters to fill them.
    if _has_unknown_parameters(prototype.parameters):
        prototype.parameters = input_method.parameters
    # Otherwise, try to enrich the parameters themselves.
    if not _has_unknown_parameters(input_method.parameters):
        if len(prototype.parameters) != len(input_method.parameters):
            print(f"[Error] Parameters count mismatch on {class_name}: \n\t{prototype}\n\t{input_method}")
            # If the method does not depend on the parameters, IDA might consider it a method without parameters.
            # So I assume the one with the parameters is the correct one.
            if not prototype.parameters:
                prototype.parameters = input_method.parameters
            return

        for proto_param, input_param in zip(prototype.parameters, input_method.parameters, strict=True):
            if proto_param.type == UNKNOWN:
                proto_param.type = input_param.type
            if proto_param.name is None:
                proto_param.name = proto_param.name


def _has_unknown_parameters(parameters: list[MethodParam]) -> bool:
    """Does this prototype have unknown parameters?"""
    return len(parameters) == 1 and parameters[0].type == UNKNOWN


if __name__ == "__main__":
    main(sys.argv[1:])
