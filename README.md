# vscode-python-bridge

This is a vscode plugin to allow remote control of visual studio from python (and jupyter notebook).

The primary purpose is to be able to do things from jupyter scripts such as:
* Have convenient buttons to build / test / deploy the project
* Run CTRL+SHIFT+P commands
* Loop through the project files to search for something
* Create advanced test scenarios that
    * set a series of breakpoints
    * generate some data
    * run the program
    * intercept the breakpoints with callbacks to your script
    * take action based upon the variables in the stack frame
    * log what is happening
    * etc.

## Theory of Operation
1. The vscode plugin starts and creates a new websocket server on a random ephemeral port number (on localhost).
2. The plugin then saves information about the vscode instance and port to ~/.vscode_instances.json in the user's home directory.
3. The python side reads this .vscode_instances.json file and and connects to the websocket.

	* NOTE: if you don't want to write a client from scratch, there is a pythonic implementation in the [pyVsCode](https://github.com/TheHeadlessSourceMan/pyVsCode) package

4. According to whatever your python program wants to do, it repeatedly:
    
    a. Generates javascript code and sends it to the websocket.
    
    b. The websocket then evaluates the javascript code and returns back the result.

5. When your python program is done, it disconnects from the websocket.
6. When the vscode instance is done, it simply shuts down.
    
    For that reason, the python code should check for and remove any entries for non-existent process id's before attempting to connect to any of them.
