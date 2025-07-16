import contextlib
import os
import struct
import sys
from pathlib import Path

from tqdm import tqdm

try:
    import ida
except ModuleNotFoundError:
    import idapro as ida

from kdk_extract_vtable import get_methods, serialize

OUT_FOLDER = Path("out")


def is_kext(path: Path) -> bool:
    """Check if the given file is a kext file"""
    if not path.is_file():
        return False

    with path.open("rb") as f:
        magic = f.read(4)

        if magic == b"\xcf\xfa\xed\xfe" or magic == b"\xfe\xed\xfa\xce":  # MH_MAGIC_64 or MH_MAGIC (32-bit)
            pass
        elif magic == b"\xca\xfe\xba\xbe":  # FAT binary
            # struct fat_header {
            #     uint32_t	magic;		/* FAT_MAGIC */
            #     uint32_t	nfat_arch;	/* number of structs that follow */
            # };

            # struct fat_arch {
            #     cpu_type_t	cputype;	/* cpu specifier (int) */
            #     cpu_subtype_t	cpusubtype;	/* machine specifier (int) */
            #     uint32_t	offset;		/* file offset to this object file */
            #     uint32_t	size;		/* size of this object file */
            #     uint32_t	align;		/* alignment as a power of 2 */
            # };
            (_,) = struct.unpack(">I", f.read(4))
            fmt = ">IIIII"
            arch_data = f.read(struct.calcsize(fmt))
            _, _, offset, _, _ = struct.unpack(fmt, arch_data)
            # Jump to slice
            f.seek(offset)

            magic = f.read(4)
            if magic != b"\xcf\xfa\xed\xfe" and magic != b"\xfe\xed\xfa\xce":
                return False
        else:
            return False  # Not Mach-O

        #   struct mach_header {
        #       uint32_t magic;      // 0xFEEDFACE or 0xFEEDFACF
        #       cpu_type_t cputype;
        #       cpu_subtype_t cpusubtype;
        #       uint32_t filetype;   // <== this field
        #       ...
        #   };
        header_fmt = "<iiI"
        header = f.read(struct.calcsize(header_fmt))
        _, _, filetype = struct.unpack(header_fmt, header)
        return filetype == 0x0B  # MH_KEXT_BUNDLE


def is_fat(path: Path) -> bool:
    """Check if the given file is a fat file"""
    if not path.is_file():
        return False

    with path.open("rb") as f:
        magic = f.read(4)

        if magic == b"\xcf\xfa\xed\xfe" or magic == b"\xfe\xed\xfa\xce":  # MH_MAGIC_64 or MH_MAGIC (32-bit)
            return False
        elif magic == b"\xca\xfe\xba\xbe":  # FAT binary
            return True
        else:
            return False  # Not Mach-O


def get_all_kexts(kdk_folder: Path) -> list[Path]:
    return [binary for binary in kdk_folder.glob("**") if not binary.name.endswith(".thin") and is_kext(binary)]


def thin_binary(binary: Path) -> Path:
    # Until IDA will support passing params to idalib open
    if not is_fat(binary):
        return binary
    new_binary = binary.with_name(binary.name + ".thin")
    if new_binary.exists():
        return new_binary
    elif not os.system(f"lipo {binary} -thin arm64e -output {new_binary}"):
        return new_binary
    return binary


def main(argv):
    if len(argv) != 2:
        print("Usage: kdk_mass_extract_vtable.py <kdk_folder> path_to_kernel_development")
        return

    kdk_folder, path_to_kernel = Path(argv[0]), Path(argv[1])
    kexts = get_all_kexts(kdk_folder)
    files = [path_to_kernel] + kexts
    files = [thin_binary(f) for f in files]

    OUT_FOLDER.mkdir(exist_ok=True)

    for i, file in (pbar := tqdm(enumerate(files), total=len(files))):
        pbar.set_description(file.name)
        open_and_process_file(file, i, len(files))


def open_and_process_file(file_path: Path, index, total):
    with ida_open(file_path):
        with open("logs.txt", "a") as f:
            with redirect_stdout(f):
                print(f"[Status] {index}/{total}: Processing {file_path.name}")
                try:
                    process_file(file_path)
                except Exception as e:
                    print(f"Failed to process {file_path}: {e}")


def process_file(file_path: Path):
    methods = get_methods()
    serialize(methods, Path("out") / (file_path.name + ".json"))
    print(f"[Info] Serialized {len(methods)} classes")


@contextlib.contextmanager
def redirect_stdout(stream):
    sys.stdout = stream
    yield
    sys.stdout = sys.__stdout__


@contextlib.contextmanager
def ida_open(file_path: Path):
    ida.open_database(str(file_path), True)
    try:
        yield
    finally:
        ida.close_database()


if __name__ == "__main__":
    main(sys.argv[1:])
