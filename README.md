# IOKitClassExplorer

Visualize classes in iOS kernel.

## Update

* Run kc_collect_classes.py on iPhone kernelcache with KC plugin.
* (Use KDK) run `kdk_mass_extract_vtable.py` with KDK path
* (Use KernelCache of mac, require opening in 8.4 with cellebrite's Kernel cache, then open in ida 9 to run the script) run `kdk_extract_vtable.py` in console and call `ida_main()`
    - remove any `ida_` references from result json.
* run `merge_vtable_and_classes`
* Copy the resources to src.