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

  return (
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
      {/* Function name header */}
      <div className="node-function-header">
        <div className="function-name">{data.label}</div>
        {metadata.block_type && (
          <div className="block-type">{metadata.block_type}</div>
        )}
        {metadata.pipeline_position > 0 && (
          <div className="pipeline-position">Position: {metadata.pipeline_position}</div>
        )}
      </div>
      
      {/* Main body with input/output handles */}
      <div className="node-body">
        <Handle 
          type="target" 
          position={Position.Left} 
          id="input"
          className={`input-handle clickable-handle ${filterType === 'input' ? 'active' : ''}`}
          onClick={handleInputClick}
        />
        <div className="input-label" onClick={handleInputClick}>
          Input ({metadata.input_count || 0})
          {metadata.input_folders && metadata.input_folders.length > 0 && (
            <div className="folder-info">{metadata.input_folders.join(', ')}</div>
          )}
        </div>
        
        <div className="center-section">
          <div className="variables-section">
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

          {/* Connectable nodes section */}
          <div className="connectable-section">
            <div className="connectable-toggle" onClick={() => toggleConnectable()}>
              <span className={`triangle ${showConnectable ? 'expanded' : ''}`}>▶</span>
              <span className="connectable-text">Connections</span>
            </div>
            
            {showConnectable && (
              <div className="connectable-content">
                {filterType === 'input' && connectableNodes.inputs.length > 0 && (
                  <div className="connectable-group">
                    <h4>Can receive from:</h4>
                    <ul>
                      {connectableNodes.inputs.map(funcName => (
                        <li key={funcName} className="connectable-item">{funcName}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {filterType === 'output' && connectableNodes.outputs.length > 0 && (
                  <div className="connectable-group">
                    <h4>Can connect to:</h4>
                    <ul>
                      {connectableNodes.outputs.map(funcName => (
                        <li key={funcName} className="connectable-item">{funcName}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(!filterType || filterType === 'both') && (
                  <>
                    {connectableNodes.inputs.length > 0 && (
                      <div className="connectable-group">
                        <h4>Can receive from:</h4>
                        <ul>
                          {connectableNodes.inputs.map(funcName => (
                            <li key={funcName} className="connectable-item">{funcName}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {connectableNodes.outputs.length > 0 && (
                      <div className="connectable-group">
                        <h4>Can connect to:</h4>
                        <ul>
                          {connectableNodes.outputs.map(funcName => (
                            <li key={funcName} className="connectable-item">{funcName}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
                {((filterType === 'input' && connectableNodes.inputs.length === 0) ||
                  (filterType === 'output' && connectableNodes.outputs.length === 0) ||
                  (!filterType && connectableNodes.inputs.length === 0 && connectableNodes.outputs.length === 0)) && (
                  <div className="no-connections">No connectable functions found</div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="output-label" onClick={handleOutputClick}>
          Output ({metadata.output_count || 0})
          {metadata.output_folders && metadata.output_folders.length > 0 && (
            <div className="folder-info">{metadata.output_folders.join(', ')}</div>
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
  const [size, setSize] = useState({ width: 320, height: 450 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Detect if the window should be in compact mode
  const isCompact = size.width < 350 || size.height < 350;

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
                      for (let functionName in functions) {
                        functionsList.push({
                          filename: file.name,
                          functionName: functionName,
                          parameters: functions[functionName],
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

        {/* Show the script name input and create button after folder selection */}
        {folderPath && (
          <>
            {/* Text box to set the name of the Python script */}
            <div className="script-name-section">
              <input
                type="text"
                value={scriptName}
                onChange={(e) => setScriptName(e.target.value)}
                placeholder="Enter script name"
              />
              <button onClick={createScriptFile} className="create-script-button">
                Create Script
              </button>
            </div>

            {/* Display file list */}
            <div className="file-list">
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
          </>
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

  const flowRef = useRef(null); // Ref for the flow container
  const wsRef = useRef(null); // Ref for the WebSocket
  const folderInputRef = useRef(null); // Add a ref for the folder input

  // Function to handle handle clicks from nodes
  const handleNodeHandleClick = useCallback((type, connectableFunctions) => {
    setFilteredFunctions(connectableFunctions);
    setFilterType(type);
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
        label, 
        folderPath, 
        inputs: {}, 
        variables: parameters,
        metadata: metadata,
        onHandleClick: handleNodeHandleClick
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
  }, [nodes, edges, folderPath, handleNodeHandleClick]);

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
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
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
            for (let functionName in functions) {
              functionsList.push({
                filename: entry.name,
                functionName: functionName,
                parameters: functions[functionName],
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
      {/* React Flow Canvas - now takes full screen */}
      <div 
        style={{ width: '100%', height: '100%' }} 
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