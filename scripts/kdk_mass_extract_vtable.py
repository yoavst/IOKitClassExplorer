import contextlib
import sys
from tqdm import tqdm
import ida
from pathlib import Path
from kdk_extract_vtable import get_methods, serialize

OUT_FOLDER = Path("out")


def main(argv):
    if len(argv) != 2:
        print(
            "Usage: kdk_mass_extract_vtable.py <kexts_folder> path_to_kernel_development"
        )
        return

    OUT_FOLDER.mkdir(exist_ok=True)

    kexts_folder, path_to_kernel = argv
    # Keep only binaries, not ida generated files or plists or whatever
    files = [Path(path_to_kernel)] + [
        file for file in Path(kexts_folder).glob("*") if not file.suffix
    ]

    for i, file in tqdm(enumerate(files), total=len(files)):
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
