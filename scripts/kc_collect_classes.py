
import idautils
import ida_xref
import ida_funcs
import ida_name
import ida_bytes
import json

pure_virtual_str = next(s for s in idautils.Strings() if str(s) == "__cxa_pure_virtual")
if not pure_virtual_str:
    print('could not find pure virtual')
else:
    dref_addr = ida_xref.get_first_dref_to(pure_virtual_str.ea)
    func = ida_funcs.get_func(dref_addr)
    ida_name.set_name(func.start_ea, '_cxa_pure_virtual', ida_name.SN_NOWARN)
    pure_virtual_ea = func.start_ea

    kc.collect_class_info()
    abstract_dict = {}
    for cls in kc.class_info.values():
        if cls.vtable is None:
            print(cls.classname, 'has no vtable')
            continue
        has_virtual_method = False
        current_ptr = cls.vtable_methods
        for i in range(cls.vtable_nmethods):
            method_addr = ida_bytes.get_qword(current_ptr)
            if method_addr == pure_virtual_ea:
                has_virtual_method = True
                break
            current_ptr += 8
        
        abstract_dict[cls.classname] = has_virtual_method

    def to_json(c):
        return {'name': c.classname, 'parent': c.superclass_name, 'is_abstract': abstract_dict.get(cls.classname, False)}

    classes = []
    for cls in kc.class_info.values():
        classes.append(to_json(cls))
    
    with open('/tmp/classes.json', 'w') as f:
        json.dump(classes, f)


