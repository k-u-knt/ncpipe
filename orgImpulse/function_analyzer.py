"""
Function Analyzer for Pipeline Blocks
=====================================
This module analyzes Python functions to extract metadata about their inputs, outputs,
and pipeline connectivity information for visual pipeline editing.

The analyzer looks for:
- loadPath and savePath patterns
- Block naming conventions (e.g., "block_o2_BSC_segmentation")
- Input/output folder relationships
- Function parameters and their types
"""

import ast
import os
import re
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass


@dataclass
class FunctionMetadata:
    """Metadata extracted from a pipeline function."""
    name: str
    filename: str
    parameters: List[str]
    input_folders: List[str]
    output_folders: List[str]
    input_count: int
    output_count: int
    block_type: str  # e.g., "preprocessing", "segmentation", "feature_extraction"
    dependencies: List[str]  # Functions this depends on (based on input/output matching)
    
    def can_connect_to(self, other: 'FunctionMetadata') -> bool:
        """Check if this function can connect to another function."""
        # Check if any of our output folders match any of their input folders
        return any(output in other.input_folders for output in self.output_folders)
    
    def get_pipeline_position(self) -> int:
        """Extract pipeline position from block name (e.g., block_o4 -> 4)."""
        # Try different patterns to extract pipeline position
        patterns = [
            r'block_o(\d+)',  # block_o4
            r'block_s(\d+)',  # block_s2
            r'block_(\d+)',   # block_4
        ]
        
        for pattern in patterns:
            match = re.search(pattern, self.name)
            if match:
                return int(match.group(1))
        
        # Special handling for visualization functions
        if self.name.startswith('block_fig_'):
            # Extract from the main block they visualize
            for pattern in patterns:
                match = re.search(pattern, self.name)
                if match:
                    return int(match.group(1))
        
        return 0


class FunctionAnalyzer:
    """Analyzes Python functions to extract pipeline metadata."""
    
    def __init__(self):
        self.functions: Dict[str, FunctionMetadata] = {}
        self.block_patterns = {
            'preprocessing': ['preprocess', 'normalize', 'filter', 'metadata', 'register'],
            'segmentation': ['segment', 'BSC', 'mask', 'CP2D', 'CP3D', 'operetta'],
            'feature_extraction': ['feature', 'extract', 'interp', 'MLP', 'class', 'bootstrap', 'UMAP', 'embedding'],
            'analysis': ['analyze', 'measure', 'quantify', 'threshold', 'ImAge', 'hist', 'validation'],
            'visualization': ['fig_', 'plot', 'visualize', 'display', 'scatter', 'MOVIE', 'HISTOGRAM'],
            'utility': ['util_', 'quick', 'check', 'QC']
        }
    
    def analyze_file(self, file_path: str) -> List[FunctionMetadata]:
        """Analyze a Python file and extract metadata for all functions."""
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        try:
            tree = ast.parse(content)
        except SyntaxError as e:
            print(f"Syntax error in {file_path}: {e}")
            return []
        
        functions = []
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                # Filter out helper functions and only include main pipeline functions
                if self._is_main_pipeline_function(node.name):
                    metadata = self._analyze_function(node, content, file_path)
                    if metadata:
                        functions.append(metadata)
                        self.functions[metadata.name] = metadata
        
        return functions
    
    def _is_main_pipeline_function(self, func_name: str) -> bool:
        """Determine if this is a main pipeline function or a helper function."""
        # Include functions that start with block_ or are main analysis functions
        if func_name.startswith('block_'):
            return True
        
        # Exclude private functions
        if func_name.startswith('_'):
            return False
            
        # Exclude common helper function patterns
        helper_patterns = [
            'projectindexer', 'format_sci', 'linear_kernel', 'get_weights',
            'predict', 'predict_score', 'forward', 'fit', 'continuousROC',
            'p_to_stars', 'process_', 'extract_', 'display_', 'train_',
            'draw_', 'update_', 'save_', 'create_', 'discover_'
        ]
        
        for pattern in helper_patterns:
            if pattern in func_name:
                return False
                
        return False
    
    def _analyze_function(self, func_node: ast.FunctionDef, file_content: str, file_path: str) -> Optional[FunctionMetadata]:
        """Analyze a single function node."""
        func_name = func_node.name
        filename = os.path.basename(file_path)
        
        # Extract parameters
        parameters = [arg.arg for arg in func_node.args.args]
        
        # Extract load and save paths
        input_folders, output_folders = self._extract_paths(func_node, file_content)
        
        # Determine block type
        block_type = self._determine_block_type(func_name, file_content)
        
        return FunctionMetadata(
            name=func_name,
            filename=filename,
            parameters=parameters,
            input_folders=input_folders,
            output_folders=output_folders,
            input_count=len(input_folders),
            output_count=len(output_folders),
            block_type=block_type,
            dependencies=[]  # Will be computed later
        )
    
    def _extract_paths(self, func_node: ast.FunctionDef, file_content: str) -> Tuple[List[str], List[str]]:
        """Extract loadPath and savePath from function content."""
        input_folders = []
        output_folders = []
        
        # Look for loadPath and savePath assignments in AST
        for node in ast.walk(func_node):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        var_name = target.id
                        
                        # Check if this is a path assignment
                        if 'load' in var_name.lower() and isinstance(node.value, ast.BinOp):
                            folder_name = self._extract_folder_name(node.value)
                            if folder_name and folder_name not in input_folders:
                                input_folders.append(folder_name)
                        
                        elif 'save' in var_name.lower() and isinstance(node.value, ast.BinOp):
                            folder_name = self._extract_folder_name(node.value)
                            if folder_name and folder_name not in output_folders:
                                output_folders.append(folder_name)
        
        # Enhanced regex patterns to catch more variations
        patterns = {
            'input': [
                r'loadPath[^=]*=.*?["\']([^"\']*block_[^"\']*)["\']',
                r'loadPaths[^=]*=.*?["\']([^"\']*block_[^"\']*)["\']',
                r'loadFolder[^=]*=.*?["\']([^"\']*block_[^"\']*)["\']',
                r'loadFolder\s*=\s*["\']([^"\']*block_[^"\']*)["\']',
                # Pattern for loadPathGenerator calls
                r'loadPathGenerator\([^)]*loadFolder\s*=\s*["\']([^"\']*block_[^"\']*)["\']',
            ],
            'output': [
                r'savePath[^=]*=.*?["\']([^"\']*block_[^"\']*)["\']',
                r'saveFolder[^=]*=.*?["\']([^"\']*block_[^"\']*)["\']',
                # Pattern for output in path construction
                r'/([^/"\'\s]*block_[^/"\'\s]*)["\']',
            ]
        }
        
        # Apply regex patterns
        for input_pattern in patterns['input']:
            matches = re.findall(input_pattern, file_content, re.IGNORECASE | re.DOTALL)
            for match in matches:
                folder_name = os.path.basename(match.strip())
                if folder_name and folder_name not in input_folders:
                    input_folders.append(folder_name)
        
        for output_pattern in patterns['output']:
            matches = re.findall(output_pattern, file_content, re.IGNORECASE | re.DOTALL)
            for match in matches:
                folder_name = os.path.basename(match.strip())
                if folder_name and folder_name not in output_folders and folder_name.startswith('block_'):
                    output_folders.append(folder_name)
        
        return input_folders, output_folders
    
    def _extract_folder_name(self, node: ast.BinOp) -> Optional[str]:
        """Extract folder name from a string concatenation expression."""
        # This is a simplified extraction - you might need to make it more robust
        # Look for string literals that contain "block_"
        for child in ast.walk(node):
            if isinstance(child, ast.Constant) and isinstance(child.value, str) and "block_" in child.value:
                return os.path.basename(child.value)
        return None
    
    def _determine_block_type(self, func_name: str, file_content: str) -> str:
        """Determine the type of processing block based on function name and content."""
        func_name_lower = func_name.lower()
        content_lower = file_content.lower()
        
        for block_type, keywords in self.block_patterns.items():
            if any(keyword in func_name_lower for keyword in keywords):
                return block_type
            if any(keyword in content_lower for keyword in keywords):
                return block_type
        
        return "unknown"
    
    def compute_dependencies(self):
        """Compute dependencies between functions based on input/output folder matching."""
        for func_name, func_meta in self.functions.items():
            dependencies = []
            for other_name, other_meta in self.functions.items():
                if other_name != func_name and other_meta.can_connect_to(func_meta):
                    dependencies.append(other_name)
            func_meta.dependencies = dependencies
    
    def get_connectable_functions(self, function_name: str) -> Dict[str, List[str]]:
        """Get functions that can connect to/from the specified function."""
        if function_name not in self.functions:
            return {"inputs": [], "outputs": []}
        
        func_meta = self.functions[function_name]
        
        # Functions that can provide input to this function
        input_functions = []
        # Functions that can receive output from this function
        output_functions = []
        
        for other_name, other_meta in self.functions.items():
            if other_name != function_name:
                if other_meta.can_connect_to(func_meta):
                    input_functions.append(other_name)
                if func_meta.can_connect_to(other_meta):
                    output_functions.append(other_name)
        
        return {
            "inputs": sorted(input_functions, key=lambda x: self.functions[x].get_pipeline_position()),
            "outputs": sorted(output_functions, key=lambda x: self.functions[x].get_pipeline_position())
        }
    
    def get_pipeline_order(self) -> List[str]:
        """Get functions sorted by their pipeline position."""
        return sorted(
            self.functions.keys(),
            key=lambda x: self.functions[x].get_pipeline_position()
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert analyzer data to dictionary for JSON serialization."""
        return {
            func_name: {
                "name": meta.name,
                "filename": meta.filename,
                "parameters": meta.parameters,
                "input_folders": meta.input_folders,
                "output_folders": meta.output_folders,
                "input_count": meta.input_count,
                "output_count": meta.output_count,
                "block_type": meta.block_type,
                "dependencies": meta.dependencies,
                "pipeline_position": meta.get_pipeline_position(),
                "connectable": self.get_connectable_functions(func_name)
            }
            for func_name, meta in self.functions.items()
        }


def analyze_folder(folder_path: str) -> FunctionAnalyzer:
    """Analyze all Python files in a folder and return analyzer with all functions."""
    analyzer = FunctionAnalyzer()
    
    for filename in os.listdir(folder_path):
        if filename.endswith('.py'):
            file_path = os.path.join(folder_path, filename)
            try:
                analyzer.analyze_file(file_path)
            except Exception as e:
                print(f"Error analyzing {filename}: {e}")
    
    # Compute dependencies after all functions are loaded
    analyzer.compute_dependencies()
    
    return analyzer


# Example usage
if __name__ == "__main__":
    # Test with the provided function
    test_file = "/Users/kentaninomiya/Documents/GitHub/PLATE-MIEL/Programs/block_o4_3Dinterp_exfeatures.py"
    
    analyzer = FunctionAnalyzer()
    functions = analyzer.analyze_file(test_file)
    
    for func in functions:
        print(f"\nFunction: {func.name}")
        print(f"  File: {func.filename}")
        print(f"  Parameters: {func.parameters}")
        print(f"  Input folders: {func.input_folders}")
        print(f"  Output folders: {func.output_folders}")
        print(f"  Block type: {func.block_type}")
        print(f"  Pipeline position: {func.get_pipeline_position()}")
