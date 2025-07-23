# Clickable Input/Output Handles Feature Guide

## Overview
We have successfully implemented clickable input and output handles in the React Flow nodes. When you click on either the input (left) or output (right) circles of a node, the floating dashboard will filter to show only functions that are compatible with that connection type.

## Features Implemented

### 1. Clickable Handles
- **Input Handle (Left Circle)**: Click to filter functions that can provide input to the current node
- **Output Handle (Right Circle)**: Click to filter functions that can receive output from the current node
- **Visual Feedback**: Active handles glow with an orange/amber color and scale up slightly

### 2. Floating Dashboard Filtering
- Shows filtered functions based on the clicked handle type
- Displays a filter header indicating the current filter mode
- Provides a "Show All" button to clear the filter
- Filtered functions are highlighted with a different color

### 3. Smart Filter Management
- Filter automatically clears when no nodes are selected
- Clicking the same handle type again toggles the filter off
- Clicking a different handle type switches the filter

## How to Use

### Step 1: Load Your Functions
1. Click "Select Folder" in the floating dashboard
2. Choose a folder containing your Python function files
3. The dashboard will populate with available functions

### Step 2: Add Nodes to Canvas
1. Drag functions from the dashboard onto the canvas
2. Each function becomes a node with input/output handles

### Step 3: Use Clickable Handles
1. Click on the **left circle (input handle)** of any node
   - The handle will glow orange
   - The dashboard will show only functions that can connect TO this node
   - These are functions whose outputs match this node's inputs

2. Click on the **right circle (output handle)** of any node
   - The handle will glow orange
   - The dashboard will show only functions that can connect FROM this node
   - These are functions whose inputs match this node's outputs

### Step 4: Clear Filters
- Click the "Show All" button in the filter header
- Click the same handle again to toggle off
- Deselect all nodes to automatically clear filters

## Visual Indicators

### Handle States
- **Normal**: Blue gradient circle
- **Hover**: Brighter blue with slight scale
- **Active (Filtering)**: Orange/amber glow with larger scale
- **Clickable**: Cursor changes to pointer

### Dashboard States
- **Unfiltered**: Shows all available functions
- **Input Filter**: Shows functions with orange header "Showing input-compatible functions"
- **Output Filter**: Shows functions with orange header "Showing output-compatible functions"
- **Filtered Functions**: Highlighted with blue gradient background

## Technical Implementation

### Frontend (React)
- Modified `CustomNode` component to handle click events
- Added state management for filter type and connectable functions
- Enhanced `FloatingDashboard` to display filtered results
- Added CSS animations and visual feedback

### Backend Integration
- Uses existing `/get-connectable-functions` API endpoint
- Leverages `FunctionAnalyzer` class for compatibility detection
- Maintains compatibility with existing folder analysis system

## Benefits

1. **Improved UX**: Users can quickly find compatible functions
2. **Visual Clarity**: Clear indication of what can connect where
3. **Efficient Workflow**: Reduces trial and error in creating pipelines
4. **Smart Filtering**: Automatically manages filter state based on user actions

## Future Enhancements

- Add drag-and-drop directly from filtered results to create connections
- Show connection preview lines when hovering over compatible functions
- Add keyboard shortcuts for filtering (e.g., 'i' for input, 'o' for output)
- Implement connection strength indicators based on compatibility scores
