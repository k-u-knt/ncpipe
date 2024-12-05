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
  // Use variables from node data
  const variables = data.variables || [];

  // Initialize inputs from node data or set to default values for each variable
  const [inputs, setInputs] = useState(() => {
    const initialInputs = {};
    variables.forEach(variable => {
      const [varName, defaultValue] = variable.replace(/"/g, '').split(':').map(v => v.trim());
      initialInputs[varName] = data.inputs?.[varName] || defaultValue || '';
    });
    return initialInputs;
  });

  const handleInputChange = (variable, value) => {
    const updatedInputs = {
      ...inputs,
      [variable]: value,
    };
    setInputs(updatedInputs);
    // Update node data inputs
    data.inputs = updatedInputs;
  };

  return (
    <div className="custom-node">
      <div className="node-header">
        <FaFileAlt className="node-icon" />
        <div className="node-title">{data.label}</div>
      </div>
      <div className="node-params">
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
      <Handle type="target" position={Position.Left} id="input" />
      <Handle type="source" position={Position.Right} id="output" />
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

  const flowRef = useRef(null); // Ref for the flow container
  const wsRef = useRef(null); // Ref for the WebSocket
  const folderInputRef = useRef(null); // Add a ref for the folder input

  // Add a new node to the canvas
  const addNode = useCallback((label, position, parameters) => {
    const nodeId = `${nodes.length + 1}`;
    const newNode = {
      id: nodeId,
      type: 'custom',
      data: { label, folderPath, inputs: {}, variables: parameters },
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
  }, [nodes, edges, folderPath]);

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
        }
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

    addNode(functionItem.functionName, centeredPosition, functionItem.parameters);
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
    <div style={{ height: '100vh', display: 'flex' }}>
      {/* Sidebar */}
      <ResizableBox
        width={300}
        height={Infinity}
        axis="x"
        minConstraints={[200, Infinity]}
        maxConstraints={[600, Infinity]}
        className="sidebar"
        handle={<span className="custom-handle" />}
      >
        <h3>Node Dashboard</h3>
        
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
              setLoading(true); // Set loading to true
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
                        });
                      }
                      resolve();
                    };
                    reader.readAsText(file);
                  }));

                await Promise.all(filePromises);

                setFileList(functionsList);
              } catch (error) {
                console.error("Failed to list files:", error);
              } finally {
                setLoading(false); // Set loading to false
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
              {fileList.map((item, index) => (
                <button 
                  key={index}
                  className="file-button"
                  draggable
                  onDragStart={(event) => onDragStart(event, item)}
                >
                  {item.functionName} (in {item.filename})
                </button>
              ))}
            </div>
          </>
        )}
      </ResizableBox>

      {/* React Flow Canvas */}
      <div 
        style={{ flexGrow: 1 }} 
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
        </ReactFlow>

        {/* Display Results */}
        {results && (
          <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
            <h3>Results</h3>
            <pre>{JSON.stringify(results, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;