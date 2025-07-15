"""
Collect C++ classes from IDB that was already processed by kernelcache-ng.
Requires:
- vtable symbols
- C++ class inheritance

Output is list[BaseClass]

@author: Yoav Sternberg <yoav.sternberg@gmail.com>
"""

import json
from typing import TypedDict, cast

from idahelper import cpp, memory, strings, tif, xrefs


class BaseClass(TypedDict):
    name: str
    parent: str | None
    is_abstract: bool


def find_pure_virtual_function() -> int:
    """Locate __cxa_pure_virtual function and rename it. Return its start ea"""
    pure_virtual_str = strings.find_str("__cxa_pure_virtual")
    pure_virtual_func_ea = next(iter(xrefs.func_xrefs_to(pure_virtual_str.ea)))
    assert pure_virtual_func_ea is not None
    memory.set_name(pure_virtual_func_ea, "___cxa_pure_virtual")
    return pure_virtual_func_ea


def collect_classes() -> list[BaseClass]:
    classes: list[BaseClass] = []
    pure_virtual_ea = find_pure_virtual_function()

    for cls, vtable_ea in cpp.get_all_cpp_classes():
        is_abstract = any(
            entry.func_ea == pure_virtual_ea for entry in cpp.iterate_vtable(vtable_ea)
        )
        parent = tif.get_parent_class(cls)
        classes.append(
            {
                "name": cast(str, cls.get_type_name()),
                "parent": cast(str, parent.get_type_name())
                if parent is not None
                else None,
                "is_abstract": is_abstract,
            }
        )
    return classes


def dump_classes(path: str):
    classes = collect_classes()
    with open(path, "w") as f:
        json.dump(classes, f, indent=4)


if __name__ == "__main__":
    print("Dumping classes from current IDB")
    dump_path = "/tmp/classes.json"
    dump_classes(dump_path)
    print(f"Successfully dumped to {dump_path}")
