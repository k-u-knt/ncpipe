# ncpipe: A Visual Pipeline for Python Functions

**Caution: This is a development repository and is not intended for full production use yet. Use at your own risk.**

`ncpipe` is a tool that allows you to visually create and execute pipelines of Python functions. It is designed to work alongside the [ImAge_workflow](https://github.com/terskikh-lab/ImAge_workflow) to provide a user-friendly interface for running complex image analysis workflows. However, it can be used with any set of Python functions.

The application consists of a Python backend powered by Sanic and a React-based frontend using React Flow.

## Installation

### Prerequisites

- Python 3.7+
- Node.js v14+ and npm

### Backend Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd ncpipe/orgImpulse
    ```

2.  **Create and activate a Python virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

3.  **Install the required Python packages:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Run the backend server:**
    ```bash
    python server.py
    ```
    The server will start on `http://localhost:8000`.

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd reactflow-frontend
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

## How to Use with ImAge_workflow

## Demonstration Video

_**(A video demonstrating the software will be added here.)**_

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

## Example with `ImAge_workflow`

When you select the `workflows` directory from the `ImAge_workflow` repository, `ncpipe` will discover the functions within the scripts. For example, it will find and list functions from the following files:

-   `o1_illumination_correction.py`
-   `o2_segmentation.py`
-   `o3_extract_features.py`
-   `o4_image_axis.py`
-   `visualization.py`

You can then drag these functions to build a visual representation of the `ImAge_workflow` pipeline, customize their parameters, and execute the entire workflow from the `ncpipe` interface.
