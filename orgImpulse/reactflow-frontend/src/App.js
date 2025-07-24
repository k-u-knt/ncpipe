// src/App.js
import React, { useState, useCallback, useRef, useEffect } from "react";
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  Handle,
  Position,
  getBezierPath,
} from "react-flow-renderer";
import axios from "axios";
import './App.css'; // Import a CSS file for styling
import { FaFileAlt } from 'react-icons/fa'; // Import an icon
import { saveAs } from 'file-saver'; // Import file-saver to save files
import { ResizableBox } from 'react-resizable'; // Import ResizableBox from 'react-resizable'

// Define the custom node component
const CustomNode = ({ id, data, selected, type }) => {
  const variables = data.variables || [];
  const metadata = data.metadata || {};

  const [inputs, setInputs] = useState(() => {
    const initialInputs = {};
    variables.forEach(variable => {
      const [varName, defaultValue] = variable.replace(/"/g, '').split(':').map(v => v.trim());
      initialInputs[varName] = data.inputs?.[varName] || defaultValue || '';
    });
    return initialInputs;
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [showConnectable, setShowConnectable] = useState(false);
  const [connectableNodes, setConnectableNodes] = useState({ inputs: [], outputs: [] });
  const [filterType, setFilterType] = useState(null); // 'input' or 'output'
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(data.displayName || data.label);
  
  // Add resize functionality
  const [size, setSize] = useState({ width: data.width || 250, height: data.height || 150 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const handleInputChange = (variable, value) => {
    const updatedInputs = {
      ...inputs,
      [variable]: value,
    };
    setInputs(updatedInputs);
    data.inputs = updatedInputs;
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleConnectable = async (type = null) => {
    if (!showConnectable && data.folderPath) {
      try {
        const response = await axios.post("http://localhost:8000/get-connectable-functions", {
          function_name: data.label,
          folder_path: data.folderPath,
        });
        setConnectableNodes(response.data.connectable);
        setFilterType(type);
        setShowConnectable(true);
        
        // Notify parent component to filter floating window
        if (data.onHandleClick) {
          const targetFunctions = type === 'input' ? response.data.connectable.inputs : response.data.connectable.outputs;
          data.onHandleClick(type, targetFunctions);
        }
        
        return response.data.connectable;
      } catch (error) {
        console.error("Failed to get connectable functions:", error);
        return { inputs: [], outputs: [] };
      }
    } else if (showConnectable && type === filterType) {
      // If clicking the same handle type, close the panel
      setShowConnectable(false);
      setFilterType(null);
      if (data.onHandleClick) {
        data.onHandleClick(null, null);
      }
    } else if (showConnectable && type !== filterType) {
      // If clicking a different handle type, just change the filter
      setFilterType(type);
      if (data.onHandleClick) {
        const targetFunctions = type === 'input' ? connectableNodes.inputs : connectableNodes.outputs;
        data.onHandleClick(type, targetFunctions);
      }
    } else {
      setShowConnectable(!showConnectable);
      setFilterType(type);
      if (data.onHandleClick) {
        data.onHandleClick(type, type === 'input' ? connectableNodes.inputs : connectableNodes.outputs);
      }
    }
  };

  const handleInputClick = async (e) => {
    e.stopPropagation();
    await toggleConnectable('input');
  };

  const handleOutputClick = async (e) => {
    e.stopPropagation();
    await toggleConnectable('output');
  };

  const handleNameClick = (e) => {
    e.stopPropagation();
    setIsEditingName(true);
  };

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setDisplayName(newName);
    data.displayName = newName; // Update the data object
  };

  const handleNameSubmit = (e) => {
    if (e.key === 'Enter' || e.type === 'blur') {
      setIsEditingName(false);
    }
  };

  // Add resize handlers
  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    // Notify parent that this node is being resized
    if (data.onResizeStateChange) {
      data.onResizeStateChange(id, true);
    }
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (isResizing) {
      const newWidth = Math.max(200, resizeStart.width + (e.clientX - resizeStart.x));
      const newHeight = Math.max(120, resizeStart.height + (e.clientY - resizeStart.y));
      setSize({ width: newWidth, height: newHeight });
      // Update data to persist size
      data.width = newWidth;
      data.height = newHeight;
    }
  }, [isResizing, resizeStart, data]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    // Notify parent that this node is no longer being resized
    if (data.onResizeStateChange) {
      data.onResizeStateChange(id, false);
    }
  }, [data, id]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div 
      className={`custom-node ${selected ? 'selected' : ''}`}
      style={{
        width: size.width,
        height: size.height,
        position: 'relative'
      }}
    >
      {/* Function name header */}
      <div className="node-function-header">
        <div className="function-name" onClick={handleNameClick}>
          {isEditingName ? (
            <input
              type="text"
              value={displayName}
              onChange={handleNameChange}
              onKeyDown={handleNameSubmit}
              onBlur={handleNameSubmit}
              autoFocus
              style={{
                background: 'transparent',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: 'inherit',
                fontWeight: 'inherit',
                color: 'inherit',
                width: '100%',
                minWidth: '120px',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            />
          ) : (
            <span style={{ 
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              maxWidth: '100%'
            }} title={`Original function: ${data.label}`}>
              {displayName}
            </span>
          )}
        </div>
        {metadata.block_type && metadata.block_type !== 'unknown' && (
          <div className="block-type">{metadata.block_type}</div>
        )}
        {metadata.pipeline_position > 0 && (
          <div className="pipeline-position">Position: {metadata.pipeline_position}</div>
        )}
      </div>
      
      {/* Main body with input/output handles */}
      <div className="node-body" style={{ height: 'calc(100% - 40px)' }}>
        <Handle 
          type="target" 
          position={Position.Left} 
          id="input"
          className={`input-handle clickable-handle ${filterType === 'input' ? 'active' : ''}`}
          onClick={handleInputClick}
        />
        <div className="input-label" onClick={handleInputClick} style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '12px',
          color: '#666',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          maxWidth: '60px',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          Input
          {metadata.input_folders && metadata.input_folders.length > 0 && (
            <div className="folder-info" style={{ 
              fontSize: '10px', 
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '60px'
            }}>
              {metadata.input_folders.join(', ')}
            </div>
          )}
        </div>
        
        <div className="center-section" style={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          padding: '10px 30px'
        }}>
          <div className="original-function-name" style={{
            fontSize: '11px',
            color: '#666',
            textAlign: 'center',
            marginBottom: '8px',
            padding: '2px 4px',
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%'
          }}>
            {data.label}
          </div>
          
          <div style={{ flex: 1 }}></div>
          
          <div className="variables-section" style={{ marginTop: 'auto' }}>
            <div className="variables-toggle" onClick={toggleExpand}>
              <span className={`triangle ${isExpanded ? 'expanded' : ''}`}>▶</span>
              <span className="variables-text">Variables</span>
            </div>
            
            {isExpanded && (
              <div className="variables-content">
                <table className="variable-table">
                  <tbody>
                    {variables.map((variable) => {
                      const [varName] = variable.replace(/"/g, '').split(':').map(v => v.trim());
                      return (
                        <tr key={varName}>
                          <td className="variable-name">{varName}</td>
                          <td className="variable-input">
                            <input
                              type="text"
                              value={inputs[varName] || ''}
                              onChange={(e) => handleInputChange(varName, e.target.value)}
                              placeholder="Enter value"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        
        <div className="output-label" onClick={handleOutputClick} style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '12px',
          color: '#666',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          maxWidth: '60px',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          Output
          {metadata.output_folders && metadata.output_folders.length > 0 && (
            <div className="folder-info" style={{ 
              fontSize: '10px', 
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '60px'
            }}>
              {metadata.output_folders.join(', ')}
            </div>
          )}
        </div>
        <Handle 
          type="source" 
          position={Position.Right} 
          id="output"
          className={`output-handle clickable-handle ${filterType === 'output' ? 'active' : ''}`}
          onClick={handleOutputClick}
        />
      </div>
      
      {/* Resize handle */}
      <div 
        className="node-resize-handle"
        onMouseDown={handleResizeMouseDown}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '20px',
          height: '20px',
          cursor: 'se-resize',
          zIndex: 1001,
          userSelect: 'none',
          pointerEvents: 'all'
        }}
        title="Drag to resize node"
      />
    </div>
  );
};

// TopToolbar component with run script and resource monitoring
const TopToolbar = ({ isRunning, onRunScript, resourceData, scriptName, setScriptName }) => {
  const [isEditingScript, setIsEditingScript] = useState(false);

  const handleScriptNameClick = () => {
    setIsEditingScript(true);
  };

  const handleScriptNameChange = (e) => {
    setScriptName(e.target.value);
  };

  const handleScriptNameSubmit = (e) => {
    if (e.key === 'Enter' || e.type === 'blur') {
      setIsEditingScript(false);
    }
  };

  return (
    <div className="top-toolbar">
      <div className="toolbar-left">
      </div>
      
      <div className="toolbar-right">
        <div style={{ display: 'flex', alignItems: 'center', marginRight: '20px' }}>
          <div style={{ marginRight: '12px' }}>
            {isEditingScript ? (
              <input
                type="text"
                value={scriptName}
                onChange={handleScriptNameChange}
                onKeyDown={handleScriptNameSubmit}
                onBlur={handleScriptNameSubmit}
                autoFocus
                style={{
                  background: 'transparent',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#333',
                  minWidth: '120px'
                }}
              />
            ) : (
              <span 
                onClick={handleScriptNameClick}
                style={{ 
                  color: '#333', 
                  fontSize: '16px', 
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid transparent',
                  background: 'rgba(255, 255, 255, 0.9)'
                }}
                title="Click to edit script name"
              >
                {scriptName}
              </span>
            )}
          </div>
          <button 
            className={`run-button ${isRunning ? 'running' : ''}`}
            onClick={onRunScript}
            disabled={isRunning}
          >
            <span className="run-icon">▶</span>
            {isRunning ? 'Running...' : 'Run Analysis'}
          </button>
        </div>
        <div className="resource-monitors">
          <div className="resource-monitor">
            <span className="resource-label">RAM</span>
            <div className="resource-bar">
              <div 
                className="resource-fill ram" 
                style={{ width: `${resourceData.ram}%` }}
              ></div>
            </div>
            <span className="resource-value">{Math.round(resourceData.ram)}%</span>
          </div>
          
          <div className="resource-monitor">
            <span className="resource-label">CPU</span>
            <div className="resource-bar">
              <div 
                className="resource-fill cpu" 
                style={{ width: `${resourceData.cpu}%` }}
              ></div>
            </div>
            <span className="resource-value">{Math.round(resourceData.cpu)}%</span>
          </div>
          
          <div className="resource-monitor">
            <span className="resource-label">GPU</span>
            <div className="resource-bar">
              <div 
                className="resource-fill gpu" 
                style={{ width: `${resourceData.gpu}%` }}
              ></div>
            </div>
            <span className="resource-value">{Math.round(resourceData.gpu)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Floating Dashboard Component
const FloatingDashboard = ({ 
  folderPath, 
  setFolderPath,
  handleFolderSelect, 
  folderInputRef, 
  loading, 
  setLoading,
  scriptName, 
  setScriptName, 
  createScriptFile, 
  fileList, 
  setFileList,
  onDragStart,
  getFunctionsAndVariables,
  filteredFunctions,
  filterType,
  clearFilter
}) => {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [size, setSize] = useState({ width: 350, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const fileListRef = useRef(null);

  // Detect if the window should be in compact mode
  const isCompact = size.width < 350 || size.height < 350;

  // Apply single column grid styling to use full height
  useEffect(() => {
    if (fileListRef.current) {
      // Use single column to maximize height usage
      fileListRef.current.style.gridTemplateColumns = '1fr';
      fileListRef.current.style.display = 'grid';
    }
  }, [fileList, filteredFunctions]);

  const handleMouseDown = (e) => {
    if (e.target.classList.contains('floating-dashboard-header') || 
        e.target.classList.contains('dashboard-title')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleResizeMouseDown = (e) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (isResizing) {
      const newWidth = Math.max(280, resizeStart.width + (e.clientX - resizeStart.x));
      const newHeight = Math.max(200, resizeStart.height + (e.clientY - resizeStart.y));
      setSize({ width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart]);

  return (
    <div 
      className="floating-dashboard"
      data-compact={isCompact}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="floating-dashboard-header">
        <h3 className="dashboard-title">NC editor</h3>
      </div>
      
      <div className="floating-dashboard-content">
        {/* Add folder selection section */}
        <div className="folder-section">
          <button onClick={handleFolderSelect} className="folder-select-button">
            Select Folder
          </button>
          {folderPath && <div className="selected-folder">{folderPath}</div>}
        </div>

        {/* Hidden input for folder selection */}
        <input
          type="file"
          webkitdirectory="true"
          directory="true"
          multiple
          style={{ display: 'none' }}
          ref={folderInputRef}
          onChange={async (e) => {
            if (e.target.files.length > 0) {
              setLoading(true);
              const folderName = e.target.files[0].webkitRelativePath.split('/')[0];
              setFolderPath(folderName);

              try {
                const functionsList = [];
                const filePromises = Array.from(e.target.files)
                  .filter(file => file.name.endsWith('.py'))
                  .filter(file => {
                    // Exclude files in subfolders
                    const relativePathParts = file.webkitRelativePath.split('/');
                    return relativePathParts.length === 2; // ['folderName', 'fileName.py']
                  })
                  .map(file => new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const functions = getFunctionsAndVariables(reader.result);
                      const functionNames = Object.keys(functions);
                      // Only add the first function from each file
                      if (functionNames.length > 0) {
                        const firstFunctionName = functionNames[0];
                        functionsList.push({
                          filename: file.name,
                          functionName: firstFunctionName,
                          parameters: functions[firstFunctionName],
                          input_folders: [],
                          output_folders: [],
                          input_count: 0,
                          output_count: 0,
                          block_type: 'unknown',
                          pipeline_position: 0
                        });
                      }
                      resolve();
                    };
                    reader.readAsText(file);
                  }));

                await Promise.all(filePromises);
                functionsList.sort((a, b) => a.filename.localeCompare(b.filename));
                setFileList(functionsList);
              } catch (error) {
                console.error("Failed to list files:", error);
              } finally {
                setLoading(false);
              }
            }
          }}
        />

        {/* Display loading indicator */}
        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
          </div>
        )}

        {/* Display file list - always present when folder is selected */}
        {folderPath && (
          <div>
            <div className="processes-header">
              <h4 style={{ margin: '10px 0 5px 0', color: '#333', fontSize: '16px', fontWeight: 'bold' }}>
                Processes
              </h4>
            </div>
            <div className="file-list" ref={fileListRef}>
            {filteredFunctions && filteredFunctions.length > 0 && (
              <div className="filter-header">
                <div className="filter-info">
                  Showing {filterType === 'input' ? 'input-compatible' : 'output-compatible'} functions
                </div>
                <button className="clear-filter-btn" onClick={clearFilter}>
                  Show All
                </button>
              </div>
            )}
            
            {(filteredFunctions && filteredFunctions.length > 0 
              ? filteredFunctions.map(funcName => {
                  const item = fileList.find(f => f.functionName === funcName);
                  return item ? (
                    <button 
                      key={`filtered-${item.functionName}`}
                      className="file-button filtered-function"
                      draggable
                      onDragStart={(event) => onDragStart(event, item)}
                    >
                      {item.functionName}
                    </button>
                  ) : null;
                }).filter(Boolean)
              : fileList.map((item, index) => (
                  <button 
                    key={index}
                    className="file-button"
                    draggable
                    onDragStart={(event) => onDragStart(event, item)}
                  >
                    {item.functionName}
                  </button>
                ))
            )}
            
            {filteredFunctions && filteredFunctions.length === 0 && (
              <div className="no-compatible-functions">
                No compatible functions found for {filterType} connections
              </div>
            )}
          </div>
          </div>
        )}
      </div>
      
      {/* Resize handle */}
      <div 
        className="resize-handle"
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
};

// Define the custom edge component
const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected, // Add selected prop
}) => {
  const edgePath = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <defs>
        <linearGradient id={`gradient-${id}`} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#007bff" stopOpacity="0" />
          <stop offset="50%" stopColor="#007bff" stopOpacity="1" />
          <stop offset="100%" stopColor="#007bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={`url(#gradient-${id})`} // Apply the gradient
        strokeWidth={10}  // Visual stroke width
        className={`react-flow__edge-path ${selected ? 'selected' : ''}`} // Apply selected class
        markerEnd={markerEnd}
      />
    </>
  );
};

// Update nodeTypes mapping for React Flow
const nodeTypes = {
  custom: CustomNode,
};

// Update edgeTypes mapping for React Flow
const edgeTypes = {
  custom: CustomEdge,
};

// Define nodeTypeOptions array for the sidebar
const nodeTypeOptions = [
  { type: 'custom', label: 'Custom Node' },
];

const initialNodes = []; // Remove initial nodes

const initialEdges = [];

const App = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [results, setResults] = useState(null);
  const [folderPath, setFolderPath] = useState("");
  const [fileList, setFileList] = useState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [loading, setLoading] = useState(false); // Add loading state
  const [scriptName, setScriptName] = useState('script.py'); // State for script name
  const [folderHandle, setFolderHandle] = useState(null);    // State for folder handle
  const [scriptFileHandle, setScriptFileHandle] = useState(null); // State for script file handle
  
  // New state for filtering functions in dashboard
  const [filteredFunctions, setFilteredFunctions] = useState(null);
  const [filterType, setFilterType] = useState(null);
  const [resizingNodeId, setResizingNodeId] = useState(null); // Track which node is being resized

  // New state for run script and resource monitoring
  const [isRunning, setIsRunning] = useState(false);
  const [resourceData, setResourceData] = useState({ ram: 0, cpu: 0, gpu: 0 });

  const flowRef = useRef(null); // Ref for the flow container
  const wsRef = useRef(null); // Ref for the WebSocket
  const folderInputRef = useRef(null); // Add a ref for the folder input

  // Function to handle handle clicks from nodes
  const handleNodeHandleClick = useCallback((type, connectableFunctions) => {
    setFilteredFunctions(connectableFunctions);
    setFilterType(type);
  }, []);

  // Function to handle resize state changes
  const handleNodeResizeStateChange = useCallback((nodeId, isResizing) => {
    setResizingNodeId(isResizing ? nodeId : null);
  }, []);

  // Function to clear filter
  const clearFilter = useCallback(() => {
    setFilteredFunctions(null);
    setFilterType(null);
  }, []);

  // Clear filter when nodes change (like when a node is deselected)
  useEffect(() => {
    const hasSelectedNode = nodes.some(node => node.selected);
    if (!hasSelectedNode && filteredFunctions) {
      clearFilter();
    }
  }, [nodes, filteredFunctions, clearFilter]);

  // Add a new node to the canvas
  const addNode = useCallback((label, position, parameters, metadata = {}) => {
    const nodeId = `${nodes.length + 1}`;
    const newNode = {
      id: nodeId,
      type: 'custom',
      data: { 
        label, // Keep the original function name
        displayName: label, // Initialize display name with function name
        folderPath, 
        inputs: {}, 
        variables: parameters,
        metadata: metadata,
        onHandleClick: handleNodeHandleClick,
        onResizeStateChange: handleNodeResizeStateChange
      },
      position: position || { x: Math.random() * 400, y: Math.random() * 400 },
    };
    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);

    // Send updated nodes and edges to the server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'graph_update',
          data: {
            nodes: updatedNodes,
            edges: edges,
          },
        })
      );
    }
  }, [nodes, edges, folderPath, handleNodeHandleClick, handleNodeResizeStateChange]);

  // Execute graph logic by sending nodes/edges to the backend
  const executeGraph = async () => {
    try {
      const response = await axios.post("http://localhost:8000/execute-graph", {
        nodes,
        edges,
      });
      setResults(response.data.results);
    } catch (error) {
      console.error("Execution failed:", error);
    }
  };

  // Function to run the script
  const handleRunScript = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    try {
      // Execute the graph
      await executeGraph();
    } catch (error) {
      console.error("Script execution failed:", error);
    } finally {
      setIsRunning(false);
    }
  };

  // Function to fetch real resource data from backend
  const updateResourceData = useCallback(async () => {
    try {
      console.log("Fetching resource data from backend...");
      const response = await axios.get("http://localhost:8000/system-resources");
      console.log("Resource data received:", response.data);
      setResourceData(response.data);
    } catch (error) {
      console.error("Failed to fetch resource data:", error.message);
      console.error("Error details:", error);
      // Fallback to simulated data if backend is unavailable
      console.log("Using fallback random data");
      setResourceData({
        ram: Math.random() * 80 + 10, // 10-90%
        cpu: Math.random() * 70 + 15, // 15-85%
        gpu: Math.random() * 60 + 20, // 20-80%
      });
    }
  }, []);

  // Set up resource monitoring interval
  useEffect(() => {
    const interval = setInterval(updateResourceData, 5000); // Update every 5 seconds
    updateResourceData(); // Initial call
    return () => clearInterval(interval);
  }, [updateResourceData]);

  // Modify onConnect to send nodes and edges to the server
  const onConnectWithSend = useCallback(
    (params) => {
      setEdges((eds) => {
        const updatedEdges = addEdge(params, eds);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "graph_update",
              data: {
                nodes: nodes,         // Include current nodes
                edges: updatedEdges,  // Include updated edges
              },
            })
          );
        }
        return updatedEdges;
      });
    },
    [nodes] // Include 'nodes' in dependencies
  );

  useEffect(() => {
    wsRef.current = new WebSocket("ws://localhost:8000/realtime-updates");

    wsRef.current.onopen = () => {
      console.log("WebSocket connection established");
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Real-time update received:", data);
      // Handle real-time updates here
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      wsRef.current.close();
    };
  }, []);

  // Use the default onNodesChange without sending updates
  const onNodesChangeWithoutSend = useCallback(
    (changes) => {
      // Filter out drag changes for nodes that are being resized
      const filteredChanges = changes.filter(change => {
        if (change.type === 'position' && change.id === resizingNodeId) {
          return false; // Don't apply position changes to the node being resized
        }
        return true;
      });
      setNodes((nds) => applyNodeChanges(filteredChanges, nds));
    },
    [setNodes, resizingNodeId]
  );

  // Modify onEdgesChange to send nodes and edges to the server
  const onEdgesChangeWithSend = useCallback(
    (changes) => {
      const relevantChanges = changes.filter(
        (change) => change.type === 'add' || change.type === 'remove'
      );

      setEdges((eds) => {
        const updatedEdges = applyEdgeChanges(changes, eds);

        if (relevantChanges.length > 0 && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'graph_update',
              data: {
                nodes: nodes,        // Include current nodes
                edges: updatedEdges, // Include updated edges
              },
            })
          );
        }

        return updatedEdges;
      });
    },
    [nodes, edges]
  );

  // Add 'readFolderContents' function
  const readFolderContents = async () => {
    if (folderHandle) {
      try {
        const functionsList = [];
        for await (const entry of folderHandle.values()) {
          // Only process files (not subdirectories) that end with .py
          if (entry.kind === 'file' && entry.name.endsWith('.py')) {
            const file = await entry.getFile();
            const content = await file.text();
            const functions = getFunctionsAndVariables(content);
            const functionNames = Object.keys(functions);
            // Only add the first function from each file
            if (functionNames.length > 0) {
              const firstFunctionName = functionNames[0];
              functionsList.push({
                filename: entry.name,
                functionName: firstFunctionName,
                parameters: functions[firstFunctionName],
              });
            }
          }
          // Explicitly skip directories - no recursive traversal
          else if (entry.kind === 'directory') {
            console.log(`Skipping directory: ${entry.name}`);
            continue;
          }
        }
        // Sort functionsList based on 'filename'
        functionsList.sort((a, b) => a.filename.localeCompare(b.filename));
        // Compare new functionsList with existing fileList
        const isEqual = JSON.stringify(functionsList) === JSON.stringify(fileList);
        if (!isEqual) {
          setFileList(functionsList);
        }
      } catch (error) {
        console.error('Failed to read folder contents:', error);
      }
    }
  };

  // Modify 'handleFolderSelect' to call 'readFolderContents'
  const handleFolderSelect = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      setFolderHandle(handle);
      setFolderPath(handle.name);
      await readFolderContents();
    } catch (error) {
      console.error('Folder selection canceled or failed:', error);
    }
  };

  // Add a useEffect hook to monitor changes
  useEffect(() => {
    let interval;
    if (folderHandle) {
      interval = setInterval(() => {
        readFolderContents();
      }, 5000); // Check every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [folderHandle]);

  // Function to create an empty Python script in the selected folder
  const createScriptFile = async () => {
    if (folderHandle && scriptName) {
      try {
        const fileHandle = await folderHandle.getFileHandle(scriptName, { create: true });
        setScriptFileHandle(fileHandle);
        // Write empty content to the file
        const writable = await fileHandle.createWritable();
        await writable.write('');
        await writable.close();
      } catch (error) {
        console.error('Failed to create script file:', error);
      }
    }
  };

  // Implement real-time script updates
  useEffect(() => {
    const updateScriptFile = async () => {
      if (scriptFileHandle) {
        try {
          const scriptContent = generatePythonScript(nodes, edges);
          const writable = await scriptFileHandle.createWritable();
          await writable.write(scriptContent);
          await writable.close();
        } catch (error) {
          console.error('Failed to update script file:', error);
        }
      }
    };
    updateScriptFile();
  }, [nodes, edges]);

  // Helper function to parse functions and variables from file content
  const getFunctionsAndVariables = (fileContent) => {
    // Simple regex-based parser for Python function definitions
    const functionRegex = /def\s+(\w+)\s*\(([^)]*)\)/g;
    const functions = {};
    let match;
    while ((match = functionRegex.exec(fileContent)) !== null) {
      const funcName = match[1];
      const params = match[2]
        .split(',')
        .map(param => param.trim().split('=')[0].trim())
        .filter(param => param);
      functions[funcName] = params;
    }
    return functions;
  };

  const onDragStart = (event, functionItem) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(functionItem));
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (event) => {
    event.preventDefault();

    const reactFlowBounds = flowRef.current.getBoundingClientRect();
    const functionItem = JSON.parse(event.dataTransfer.getData('application/reactflow'));

    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

    const centeredPosition = {
      x: position.x - 75,
      y: position.y - 25,
    };

    // Extract metadata for the node
    const metadata = {
      input_folders: functionItem.input_folders || [],
      output_folders: functionItem.output_folders || [],
      input_count: functionItem.input_count || 0,
      output_count: functionItem.output_count || 0,
      block_type: functionItem.block_type || 'unknown',
      pipeline_position: functionItem.pipeline_position || 0
    };

    addNode(functionItem.functionName, centeredPosition, functionItem.parameters, metadata);
  };

  const onDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  // Function to generate Python script from nodes and edges
  const generatePythonScript = (nodes, edges) => {
    let script = '';
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const visited = new Set();

    const visitNode = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = nodeMap.get(nodeId);
      const { label, inputs, variables } = node.data;
      const filename = node.data.label + '.py'; // Remove folder path
      const isConnected = edges.some(edge => edge.source === node.id || edge.target === node.id);
      const commentPrefix = isConnected ? '' : '# ';

      script += `${commentPrefix}from ${filename.replace('.py', '')} import ${label}\n`;
      const params = variables.map(variable => {
        const [varName] = variable.replace(/"/g, '').split(':').map(v => v.trim());
        return `${varName}=${inputs[varName] || 'None'}`;
      }).join(', ');
      script += `${commentPrefix}${label}(${params})\n\n`;

      edges.filter(edge => edge.source === nodeId).forEach(edge => visitNode(edge.target));
    };

    nodes.forEach(node => {
      if (!edges.some(edge => edge.target === node.id)) {
        visitNode(node.id);
      }
    });

    return script;
  };

  // Function to save the generated Python script
  const savePythonScript = () => {
    const script = generatePythonScript(nodes, edges);
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, scriptName);
  };

  return (
    <div style={{ height: '100vh', position: 'relative' }}>
      {/* Top Toolbar */}
      <TopToolbar 
        isRunning={isRunning}
        onRunScript={handleRunScript}
        resourceData={resourceData}
        scriptName={scriptName}
        setScriptName={setScriptName}
      />
      
      {/* React Flow Canvas - now takes full screen minus toolbar */}
      <div 
        style={{ width: '100%', height: 'calc(100% - 60px)', marginTop: '60px' }} 
        ref={flowRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeWithoutSend}
          onEdgesChange={onEdgesChangeWithSend}
          onConnect={onConnectWithSend}
          onInit={setReactFlowInstance}
          edgeTypes={edgeTypes}             // Add edgeTypes to ReactFlow
          edgeOptions={{ type: 'custom' }}  // Set the default edge type
          zoomOnScroll={false}
          panOnScroll={false}
          fitView
          nodeTypes={nodeTypes}
        >
          <MiniMap />
          <Controls />
          <Background />
          
          {/* SVG Gradient Definition for Edges */}
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(99, 102, 241, 0.8)" />
                <stop offset="50%" stopColor="rgba(139, 92, 246, 0.9)" />
                <stop offset="100%" stopColor="rgba(99, 102, 241, 0.8)" />
              </linearGradient>
            </defs>
          </svg>
        </ReactFlow>

        {/* Display Results */}
        {results && (
          <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
            <h3>Results</h3>
            <pre>{JSON.stringify(results, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Floating Dashboard */}
      <FloatingDashboard
        folderPath={folderPath}
        setFolderPath={setFolderPath}
        handleFolderSelect={handleFolderSelect}
        folderInputRef={folderInputRef}
        loading={loading}
        setLoading={setLoading}
        scriptName={scriptName}
        setScriptName={setScriptName}
        createScriptFile={createScriptFile}
        fileList={fileList}
        setFileList={setFileList}
        onDragStart={onDragStart}
        getFunctionsAndVariables={getFunctionsAndVariables}
        filteredFunctions={filteredFunctions}
        filterType={filterType}
        clearFilter={clearFilter}
      />
    </div>
  );
};

export default App;