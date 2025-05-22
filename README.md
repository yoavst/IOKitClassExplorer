# IOKitClassExplorer

Visualize classes in iOS kernel.

## Update

* Run kc_collect_classes.py on iPhone kernelcache with KC_ng plugin.
* (Use KDK) run `kdk_mass_extract_vtable.py` with KDK path
* run `merge_vtable_and_classes`
* Copy the resources to src.

Note: The kernel cache for mac seems to cause issues, so run it on the KDK instead.