# IOKitClassExplorer

Visualize classes in iOS kernel.

## Update
* Install `idahelper` python package.
* Run collect_classes.py on iPhone kernelcache with KC_ng plugin.
* (Use KDK) run `kdk_mass_extract_vtable.py` with KDK path
* Run `kdk_extract_vtable.py` inside 16.4 iOS Kernelcache.
* run `merge_vtable_and_classes`
* Copy the resources to src.

Note: The kernel cache for mac seems to cause issues, so run it on the KDK instead.