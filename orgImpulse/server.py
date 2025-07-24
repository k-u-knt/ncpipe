# server.py
import tkinter as tk
from tkinter import filedialog
from sanic import Sanic
from sanic.response import json as sanic_json  # Rename to avoid conflict
from sanic_cors import CORS
import json as json_module  # Rename json module import
import os
import inspect  # Add import for inspect module
import ast  # Add import for ast module
import psutil  # For CPU and RAM monitoring
import platform  # For system detection
import subprocess  # For GPU monitoring commands
from function_analyzer import FunctionAnalyzer, analyze_folder

app = Sanic("NodePythonExecutor")
CORS(app)

clients = []

def get_functions_and_variables(file_path):
    with open(file_path, "r") as file:
        file_content = file.read()
    
    tree = ast.parse(file_content)
    functions = {}
    
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            func_name = node.name
            param_names = [arg.arg for arg in node.args.args]
            functions[func_name] = param_names
    
    return functions

@app.websocket("/realtime-updates")
async def realtime_updates(request, ws):
    clients.append(ws)
    try:
        while True:
            data = await ws.recv()
            message = json_module.loads(data)
            if message.get("type") == "graph_update":
                nodes = message["data"]["nodes"]
                edges = message["data"]["edges"]
                print("Received nodes:", nodes, flush=True)
                print("Received edges:", edges, flush=True)
            else:
                print("Received data from client:", data, flush=True)
    except Exception as e:
        print("WebSocket error:", e)
    finally:
        clients.remove(ws)

def get_gpu_usage():
    """Get GPU usage percentage for different GPU types"""
    try:
        system = platform.system()
        
        if system == "Darwin":  # macOS
            if platform.machine() == "arm64":  # Apple Silicon
                try:
                    # Try powermetrics without sudo first
                    result = subprocess.run(
                        ["powermetrics", "--samplers", "gpu_power", "-i", "100", "-n", "1"],
                        capture_output=True, text=True, timeout=10
                    )
                    if result.returncode == 0:
                        # Parse powermetrics output for GPU usage
                        for line in result.stdout.split('\n'):
                            if ('GPU Busy' in line or 'GPU Active' in line) and '%' in line:
                                import re
                                match = re.search(r'(\d+\.?\d*)%', line)
                                if match:
                                    return float(match.group(1))
                    
                    return 0  # Return 0 if not found or command fails
                except (FileNotFoundError, Exception) as e:
                    print(f"Apple Silicon GPU monitoring error with powermetrics: {e}")
                    return 0
            else:
                # Intel Macs - try system_profiler for basic GPU info
                try:
                    result = subprocess.run(
                        ["system_profiler", "SPDisplaysDataType"],
                        capture_output=True, text=True, timeout=5
                    )
                    # Intel Macs don't provide easy GPU utilization access
                    return 0
                except Exception:
                    return 0
                
        elif system == "Linux":
            # Try NVIDIA first
            try:
                result = subprocess.run(
                    ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
                    capture_output=True, text=True, timeout=5, check=True
                )
                return float(result.stdout.strip().split('\n')[0])
            except (FileNotFoundError, subprocess.CalledProcessError, Exception) as e:
                if not isinstance(e, FileNotFoundError):
                    print(f"NVIDIA GPU monitoring error: {e}")

            # Try AMD GPU with radeontop
            try:
                result = subprocess.run(
                    ["radeontop", "-d", "-", "-l", "1"],
                    capture_output=True, text=True, timeout=5, check=True
                )
                # Parse radeontop output for GPU usage
                for line in result.stdout.split('\n'):
                    if 'gpu' in line.lower() and '%' in line:
                        import re
                        match = re.search(r'(\d+\.?\d*)%', line)
                        if match:
                            return float(match.group(1))
            except (FileNotFoundError, subprocess.CalledProcessError, Exception) as e:
                if not isinstance(e, FileNotFoundError):
                    print(f"AMD GPU monitoring error: {e}")

            # Try Intel GPU on Linux
            try:
                result = subprocess.run(
                    ["intel_gpu_top", "-s", "1000", "-n", "1"],
                    capture_output=True, text=True, timeout=5, check=True
                )
                for line in result.stdout.split('\n'):
                    if 'Render/3D' in line and '%' in line:
                        import re
                        match = re.search(r'(\d+\.?\d*)%', line)
                        if match:
                            return float(match.group(1))
            except (FileNotFoundError, subprocess.CalledProcessError, Exception) as e:
                if not isinstance(e, FileNotFoundError):
                    print(f"Intel GPU monitoring error: {e}")
                
        elif system == "Windows":
            # Windows GPU monitoring
            try:
                # Try nvidia-smi first
                result = subprocess.run(
                    ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
                    capture_output=True, text=True, timeout=5, check=True
                )
                return float(result.stdout.strip().split('\n')[0])
            except (FileNotFoundError, subprocess.CalledProcessError, Exception):
                pass
            
            # Try wmic for basic GPU info (limited utilization data)
            try:
                result = subprocess.run(
                    ["wmic", "path", "win32_videocontroller", "get", "name"],
                    capture_output=True, text=True, timeout=5
                )
                # Windows doesn't provide easy GPU utilization via wmic
                return 0
            except Exception:
                return 0
                
        # Fallback for other systems or if monitoring fails
        return 0
        
    except Exception as e:
        print(f"GPU monitoring error: {e}")
        return 0

def get_system_resources():
    """Get current system resource usage with detailed metrics"""
    try:
        # CPU usage - use longer interval for more accurate reading
        cpu_percent = psutil.cpu_percent(interval=0.5)
        
        # Get per-core CPU usage for more detailed monitoring
        cpu_per_core = psutil.cpu_percent(interval=0.1, percpu=True)
        cpu_count = psutil.cpu_count()
        cpu_count_logical = psutil.cpu_count(logical=True)
        
        # CPU frequency
        try:
            cpu_freq = psutil.cpu_freq()
            cpu_freq_current = cpu_freq.current if cpu_freq else 0
            cpu_freq_max = cpu_freq.max if cpu_freq else 0
        except (AttributeError, OSError):
            cpu_freq_current = 0
            cpu_freq_max = 0
        
        # RAM usage with detailed breakdown
        memory = psutil.virtual_memory()
        ram_percent = memory.percent
        ram_used_gb = memory.used / (1024**3)  # Convert to GB
        ram_total_gb = memory.total / (1024**3)  # Convert to GB
        ram_available_gb = memory.available / (1024**3)  # Convert to GB
        
        # Swap memory
        swap = psutil.swap_memory()
        swap_percent = swap.percent
        swap_used_gb = swap.used / (1024**3)
        swap_total_gb = swap.total / (1024**3)
        
        # Disk usage for the current directory
        try:
            disk_usage = psutil.disk_usage('/')
            disk_percent = (disk_usage.used / disk_usage.total) * 100
            disk_used_gb = disk_usage.used / (1024**3)
            disk_total_gb = disk_usage.total / (1024**3)
            disk_free_gb = disk_usage.free / (1024**3)
        except Exception:
            disk_percent = 0
            disk_used_gb = 0
            disk_total_gb = 0
            disk_free_gb = 0
        
        # Network I/O
        try:
            net_io = psutil.net_io_counters()
            net_sent_mb = net_io.bytes_sent / (1024**2)  # Convert to MB
            net_recv_mb = net_io.bytes_recv / (1024**2)  # Convert to MB
        except Exception:
            net_sent_mb = 0
            net_recv_mb = 0
        
        # Process count
        try:
            process_count = len(psutil.pids())
        except Exception:
            process_count = 0
        
        # Load average (Unix-like systems)
        try:
            if hasattr(os, 'getloadavg'):
                load_avg = os.getloadavg()
                load_1min, load_5min, load_15min = load_avg
            else:
                load_1min = load_5min = load_15min = 0
        except Exception:
            load_1min = load_5min = load_15min = 0
        
        # GPU usage
        gpu_percent = get_gpu_usage()
        
        # System uptime
        try:
            boot_time = psutil.boot_time()
            uptime_seconds = psutil.time.time() - boot_time
            uptime_hours = uptime_seconds / 3600
        except Exception:
            uptime_hours = 0
        
        # Temperature monitoring (if available)
        temperatures = {}
        try:
            if hasattr(psutil, 'sensors_temperatures'):
                temp_sensors = psutil.sensors_temperatures()
                for name, entries in temp_sensors.items():
                    if entries:
                        temperatures[name] = entries[0].current
        except (AttributeError, Exception):
            pass
        
        return {
            # Primary metrics (for compatibility)
            "cpu": round(cpu_percent, 1),
            "ram": round(ram_percent, 1),
            "gpu": round(gpu_percent, 1),
            
            # Detailed CPU metrics
            "cpu_detailed": {
                "percent": round(cpu_percent, 1),
                "per_core": [round(core, 1) for core in cpu_per_core],
                "count_physical": cpu_count,
                "count_logical": cpu_count_logical,
                "frequency_current": round(cpu_freq_current, 1),
                "frequency_max": round(cpu_freq_max, 1),
                "load_avg": {
                    "1min": round(load_1min, 2),
                    "5min": round(load_5min, 2),
                    "15min": round(load_15min, 2)
                }
            },
            
            # Detailed RAM metrics
            "ram_detailed": {
                "percent": round(ram_percent, 1),
                "used_gb": round(ram_used_gb, 2),
                "total_gb": round(ram_total_gb, 2),
                "available_gb": round(ram_available_gb, 2),
                "swap_percent": round(swap_percent, 1),
                "swap_used_gb": round(swap_used_gb, 2),
                "swap_total_gb": round(swap_total_gb, 2)
            },
            
            # Disk metrics
            "disk": {
                "percent": round(disk_percent, 1),
                "used_gb": round(disk_used_gb, 2),
                "total_gb": round(disk_total_gb, 2),
                "free_gb": round(disk_free_gb, 2)
            },
            
            # Network metrics
            "network": {
                "sent_mb": round(net_sent_mb, 2),
                "received_mb": round(net_recv_mb, 2)
            },
            
            # System metrics
            "system": {
                "process_count": process_count,
                "uptime_hours": round(uptime_hours, 1),
                "platform": platform.system(),
                "architecture": platform.machine(),
                "temperatures": temperatures
            }
        }
    except Exception as e:
        print(f"Resource monitoring error: {e}")
        # Return fallback values
        return {
            "cpu": 0,
            "ram": 0,
            "gpu": 0,
            "cpu_detailed": {"percent": 0, "per_core": [], "count_physical": 0, "count_logical": 0},
            "ram_detailed": {"percent": 0, "used_gb": 0, "total_gb": 0, "available_gb": 0},
            "disk": {"percent": 0, "used_gb": 0, "total_gb": 0, "free_gb": 0},
            "network": {"sent_mb": 0, "received_mb": 0},
            "system": {"process_count": 0, "uptime_hours": 0, "platform": "unknown", "architecture": "unknown"}
        }

@app.route("/system-resources", methods=["GET"])
async def system_resources(request):
    """Endpoint to get current system resource usage"""
    resources = get_system_resources()
    return sanic_json(resources)

@app.post("/execute-graph")
async def execute_graph(request):
    nodes = request.json.get("nodes", [])
    edges = request.json.get("edges", [])

    # Print nodes and edges to the terminal
    print("Received nodes:", nodes, flush=True)
    print("Received edges:", edges, flush=True)

    # Create a mapping of node IDs to their data
    node_data = {node["id"]: node for node in nodes}

    # Prepare execution order based on edges (simple topological sort)
    execution_order = []
    visited = set()

    def visit(node_id):
        if node_id in visited:
            return
        visited.add(node_id)
        for edge in edges:
            if edge["target"] == node_id:
                visit(edge["source"])
        execution_order.append(node_id)

    for node in nodes:
        visit(node["id"])

    results = {}
    for node_id in execution_order:
        node = node_data[node_id]
        func_name = node["data"].get("label")
        inputs = node["data"].get("inputs", {})
        folder_path = node["data"].get("folderPath")

        if not folder_path or not os.path.isdir(folder_path):
            return sanic_json({"error": "Invalid folder path"}, status=400)

        # Fetch function from the file and parse its arguments
        function_file = None
        function_node = None
        for filename in os.listdir(folder_path):
            if filename.endswith(".py"):
                full_path = os.path.join(folder_path, filename)
                with open(full_path, "r") as file:
                    file_content = file.read()
                    tree = ast.parse(file_content)
                    for n in ast.walk(tree):
                        if isinstance(n, ast.FunctionDef) and n.name == func_name:
                            function_file = full_path
                            function_node = n
                            break
                if function_file:
                    break

        if not function_file or not function_node:
            return sanic_json({"error": f"Function '{func_name}' not found"}, status=400)

        # Get the parameter names from the function definition
        param_names = [arg.arg for arg in function_node.args.args]

        # Prepare arguments in the correct order
        args = []
        for param in param_names:
            value = inputs.get(param)
            if value is None:
                return sanic_json({"error": f"Input '{param}' not provided for function '{func_name}'"}, status=400)
            args.append(value)

        # Load and execute the function
        function_globals = {}
        with open(function_file, "r") as file:
            file_content = file.read()
        exec(file_content, function_globals)

        if func_name not in function_globals:
            return sanic_json({"error": f"Function '{func_name}' not found in file"}, status=400)

        func = function_globals[func_name]

        # Execute the function and store result
        try:
            result = func(*args)
            results[node_id] = result
        except Exception as e:
            return sanic_json({"error": str(e)}, status=500)

    # Send real-time update to all connected clients
    for client in clients:
        await client.send(json_module.dumps({"results": results}))

    return sanic_json({"results": results})

@app.post("/list-files")
async def list_files(request):
    folder_path = request.json.get("folder_path")
    if not folder_path or not os.path.isdir(folder_path):
        return sanic_json({"error": "Invalid folder path"}, status=400)

    try:
        # Use the new function analyzer
        analyzer = analyze_folder(folder_path)
        
        # Convert to the expected format with enhanced metadata
        files = []
        for func_name, func_meta in analyzer.functions.items():
            # Only include main functions (not private helper functions)
            if not func_name.startswith('_'):
                files.append({
                    "filename": func_meta.filename,
                    "functionName": func_meta.name,
                    "parameters": func_meta.parameters,
                    "input_folders": func_meta.input_folders,
                    "output_folders": func_meta.output_folders,
                    "input_count": func_meta.input_count,
                    "output_count": func_meta.output_count,
                    "block_type": func_meta.block_type,
                    "pipeline_position": func_meta.get_pipeline_position(),
                    "connectable": analyzer.get_connectable_functions(func_name)
                })
        
        # Sort by pipeline position
        files.sort(key=lambda x: x["pipeline_position"])
        
        return sanic_json({"files": files, "pipeline_metadata": analyzer.to_dict()})
    except Exception as e:
        return sanic_json({"error": str(e)}, status=500)

@app.post("/get-connectable-functions")
async def get_connectable_functions(request):
    function_name = request.json.get("function_name")
    folder_path = request.json.get("folder_path")
    
    if not folder_path or not os.path.isdir(folder_path):
        return sanic_json({"error": "Invalid folder path"}, status=400)
    
    if not function_name:
        return sanic_json({"error": "Function name required"}, status=400)
    
    try:
        analyzer = analyze_folder(folder_path)
        connectable = analyzer.get_connectable_functions(function_name)
        
        if function_name in analyzer.functions:
            func_meta = analyzer.functions[function_name]
            return sanic_json({
                "function": function_name,
                "connectable": connectable,
                "metadata": {
                    "input_folders": func_meta.input_folders,
                    "output_folders": func_meta.output_folders,
                    "block_type": func_meta.block_type,
                    "pipeline_position": func_meta.get_pipeline_position()
                }
            })
        else:
            return sanic_json({"error": f"Function '{function_name}' not found"}, status=404)
    
    except Exception as e:
        return sanic_json({"error": str(e)}, status=500)

@app.post("/list-function-variables")
async def list_function_variables(request):
    function_name = request.json.get("function_name")
    folder_path = request.json.get("folder_path")

    if not folder_path or not os.path.isdir(folder_path):
        return sanic_json({"error": "Invalid folder path"}, status=400)

    function_found = False
    for filename in os.listdir(folder_path):
        if filename.endswith(".py"):
            full_path = os.path.join(folder_path, filename)
            functions = get_functions_and_variables(full_path)
            if function_name in functions:
                variables = functions[function_name]
                function_found = True
                return sanic_json({"variables": variables})
    
    if not function_found:
        return sanic_json({"error": f"Function '{function_name}' not found"}, status=400)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)