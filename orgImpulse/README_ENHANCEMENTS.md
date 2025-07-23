# Function Pipeline Analysis System

## Overview

This enhanced system analyzes Python functions to extract pipeline metadata and suggests connectable nodes for visual pipeline editing. It's specifically designed for data processing pipelines where functions read from and write to specific folders.

## Key Features

### 1. **Function Metadata Extraction**
Each function is analyzed to extract:
- **Function name** and **filename**
- **Parameters** and their types
- **Input folders** (loadPath analysis)
- **Output folders** (savePath analysis)
- **Input/Output counts**
- **Block type** (preprocessing, segmentation, feature_extraction, etc.)
- **Pipeline position** (extracted from function names like `block_o4`)

### 2. **Connectivity Analysis**
The system determines which functions can connect to each other by:
- Matching output folders of one function to input folders of another
- Suggesting connectable nodes in a floating window
- Providing visual indicators for compatible connections

### 3. **Enhanced UI Components**

#### **Custom Nodes**
- Display function metadata (block type, pipeline position)
- Show input/output folder information
- Show input/output counts
- Expandable sections for:
  - Variables (parameters with input fields)
  - Connections (shows compatible functions)

#### **Floating Dashboard**
- Lists functions sorted by pipeline position
- Drag and drop functions to canvas
- Enhanced with metadata information

### 4. **Example Analysis**

For your `block_o4_3Dinterp_exfeatures` function, the system extracts:

```python
Function: block_o4_3Dinterp_exfeatures
  Parameters: ['project', 'binS', 'statPara', 'contents', 'segCh', 'illumiCorrection', 'resource_proportion']
  Input folders: ['block_o2_BSC_segmentation']
  Output folders: ['block_o4_3Dinterp_exfeatures']
  Block type: segmentation
  Pipeline position: 4
  Input count: 1
  Output count: 1
```

## Implementation Details

### **Function Analyzer (`function_analyzer.py`)**

```python
class FunctionMetadata:
    name: str
    filename: str
    parameters: List[str]
    input_folders: List[str]
    output_folders: List[str]
    input_count: int
    output_count: int
    block_type: str
    dependencies: List[str]
    
    def can_connect_to(self, other: 'FunctionMetadata') -> bool:
        """Check if this function can connect to another function."""
        return any(output in other.input_folders for output in self.output_folders)
```

### **Server Enhancements**
- New endpoint: `/get-connectable-functions`
- Enhanced `/list-files` endpoint with metadata
- Function analysis integration

### **Frontend Enhancements**
- Enhanced `CustomNode` component with metadata display
- Connection suggestions in floating window
- Improved visual indicators for compatibility

## Usage

1. **Select Folder**: Choose a folder containing Python pipeline functions
2. **View Functions**: Functions are listed with their metadata in the floating dashboard
3. **Drag to Canvas**: Drag functions to create nodes on the canvas
4. **View Connections**: Click "Connections" on any node to see:
   - Functions that can provide input (upstream)
   - Functions that can receive output (downstream)
5. **Connect Nodes**: Use the visual connection handles to link compatible functions
6. **Configure Parameters**: Expand "Variables" to set function parameters

## Benefits

1. **Visual Pipeline Design**: See the entire data processing pipeline visually
2. **Automatic Compatibility**: System prevents incompatible connections
3. **Metadata-Driven**: Rich information about each function's role and position
4. **Real-time Suggestions**: Dynamic suggestions for connectable functions
5. **Type-Aware Connections**: Understands data flow through folder patterns

## Pipeline Example

```
block_o1_preprocessing → block_o2_BSC_segmentation → block_o4_3Dinterp_exfeatures
     (Input: raw)           (Input: preprocessed)         (Input: segmented)
     (Output: preprocessed) (Output: segmented)           (Output: features)
```

The system automatically recognizes these relationships and suggests appropriate connections in the UI.

## Future Enhancements

1. **Semantic Analysis**: Analyze function content for better type detection
2. **Data Flow Validation**: Validate data types and formats between connected functions
3. **Auto-Layout**: Automatically arrange nodes based on pipeline order
4. **Parameter Propagation**: Automatically pass compatible parameters between functions
5. **Execution Preview**: Show estimated execution order and resource requirements
