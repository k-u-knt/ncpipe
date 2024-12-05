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
        files = []
        for filename in os.listdir(folder_path):
            full_path = os.path.join(folder_path, filename)
            if os.path.isfile(full_path) and filename.endswith(".py"):
                functions = get_functions_and_variables(full_path)
                if functions:
                    files.append({
                        "filename": filename,
                        "functions": functions
                    })
        return sanic_json({"files": files})
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