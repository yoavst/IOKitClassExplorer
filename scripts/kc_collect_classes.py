import idautils
import ida_xref
import ida_funcs
import ida_name
import json
import ida_kernelcache.kernelcache as kernelcache
from ida_kernelcache.phases import CollectClasses, CollectVtables

pure_virtual_str = next(s for s in idautils.Strings() if str(s) == "__cxa_pure_virtual")
if not pure_virtual_str:
    print("could not find pure virtual")
else:
    dref_addr = ida_xref.get_first_dref_to(pure_virtual_str.ea)
    func = ida_funcs.get_func(dref_addr)
    ida_name.set_name(func.start_ea, "_cxa_pure_virtual", ida_name.SN_NOWARN)
    pure_virtual_ea = func.start_ea

    kc = kernelcache.KernelCache()
    kc.process(phases=[CollectClasses, CollectVtables])

    abstract_dict = {}
    for cls in kc.class_info_map.values():
        if cls.vtable_info is None:
            print(cls.class_name, "has no vtable")
            continue
        has_virtual_method = False
        for v in cls.vtable_info.entries:
            if v.pure_virtual:
                has_virtual_method = True
                break

        abstract_dict[cls.class_name] = has_virtual_method

    def to_json(c):
        return {
            "name": c.class_name,
            "parent": c.superclass.class_name if c.superclass is not None else None,
            "is_abstract": abstract_dict.get(cls.class_name, False),
        }

    classes = []
    for cls in kc.class_info_map.values():
        classes.append(to_json(cls))

    with open("/tmp/classes.json", "w") as f:
        json.dump(classes, f)
