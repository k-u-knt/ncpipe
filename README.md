# ncpipe: A Visual Pipeline for Python Functions

**Caution: This is a development repository and is not intended for full production use yet. Use at your own risk.**

`ncpipe` is a general-purpose tool that allows you to visually create and execute pipelines of Python functions. While it can be used with any set of Python scripts, it is useful for orchestrating multi-step workflows, like the one provided by the [ImAge_workflow](https://github.com/terskikh-lab/ImAge_workflow) repository.

The application consists of a Python backend powered by Sanic and a React-based frontend using React Flow.

## Installation

### Prerequisites

- Python 3.7+
- Node.js v14+ and npm

### Backend Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd ncpipe
    ```

2.  **Create and activate a Python virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

3.  **Install the required Python packages:**
    ```bash
    pip install -r orgImpulse/requirements.txt
    ```

4.  **Run the backend server:**
    ```bash
    python orgImpulse/server.py
    ```
    The server will start on `http://localhost:8000`.

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd orgImpulse/reactflow-frontend
    ```

2.  **Install npm dependencies:**
    ```bash
    npm install
    ```

3.  **Start the React development server:**
    ```bash
    npm start
    ```
    The application will open in your browser at `http://localhost:3000`.

## How to Use

## Demonstration Video

_**(A video demonstrating the software will be added here.)**_

1.  **Select a Folder:** Click the "Select Folder" button in the sidebar to choose a directory containing your Python scripts. The application will parse the files and list the available functions.

2.  **Build Your Pipeline:**
    - Drag functions from the sidebar and drop them onto the canvas to create nodes.
    - Click and drag from the handle on the right side of a node to the handle on the left side of another node to connect them and define the execution flow.

3.  **Configure Functions:**
    - For each node on the canvas, you will see a table of its parameters.
    - Fill in the required values for each parameter in the input fields.

4.  **Create a Pipeline Script:**
    - After selecting a folder, you can specify a name for your pipeline script (e.g., `my_pipeline.py`).
    - Click "Create Script". This will create a new Python file in the selected folder that represents your visual pipeline. As you build your pipeline in the UI, this script will be updated in real-time.

5.  **Execute the Pipeline:**
    - The execution is currently handled by the backend when changes are made. To trigger an execution of the full graph, you can use the "Execute Graph" button (if available) or see the results update as you build the graph. The results will be displayed in a panel at the bottom of the page.

## Example with `ImAge_workflow`

While `ncpipe` is a general-purpose tool, it can be effectively used to run the `ImAge_workflow`. Here’s how:

1.  **Set up the `ImAge_workflow` repository:**
    - Clone the [ImAge_workflow repository](https://github.com/terskikh-lab/ImAge_workflow).
    - Follow its installation instructions to set up the environment, including downloading the sample data.

2.  **Select the `workflows` Folder:**
    - In the `ncpipe` application, click the "Select Folder" button.
    - Navigate to and select the `workflows` directory inside your local `ImAge_workflow` repository.
    - The application will parse the Python scripts in this folder and display the available functions in the sidebar.

3.  **Build Your Pipeline:**
    - The functions from the `ImAge_workflow` scripts (e.g., `o1_illumination_correction.py`, `o2_segmentation.py`) will be available to use as nodes.
    - Drag the functions you need onto the canvas. A typical workflow would follow the numerical order of the scripts:
        1.  A function from `o1_illumination_correction.py`
        2.  A function from `o2_segmentation.py`
        3.  A function from `o3_extract_features.py`
        4.  A function from `o4_image_axis.py`
    - Connect the nodes to define the data flow.

4.  **Configure and Execute:**
    - Fill in the parameters for each node. This will likely involve specifying paths to your data and configuration files.
    - Once the pipeline is configured, you can create a pipeline script and execute it.
