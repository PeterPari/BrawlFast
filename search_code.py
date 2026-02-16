import os
import sys

def search_files(directory, search_term):
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.git' in dirs:
            dirs.remove('.git')
            
        for file in files:
            if file.endswith(('.js', '.ts', '.html', '.css', '.md')):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        for i, line in enumerate(lines):
                            if search_term.lower() in line.lower():
                                print(f"{filepath}:{i+1}: {line.strip()}")
                except Exception as e:
                    pass

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python search_code.py <directory> <search_term>")
        sys.exit(1)
    
    search_files(sys.argv[1], sys.argv[2])
