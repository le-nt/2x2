# R*blox

### How 2 start deving

```git clone https://github.com/MoonicTeam/roblox.git```

[Install VCPKG](https://learn.microsoft.com/en-us/vcpkg/get_started/overview#get-started-with-vcpkg)

Open in VSCode

Install the  [Cmake tools](https://open-vsx.org/extension/ms-vscode/cmake-tools) extensions for VSCode

Now, you are almost ready to build. You must select a configure preset, how do we do this?
- Ctrl + Shift + P 
- Type in ```>CMake: Select Configure Preset```

Types of clients you can build:
- Clang [bla bla bla] 

this is the linux client

- Emscripten [bla bla bla]

this is the webclient

- Clang RCC [bla bla bla]

RCC, the server for the clients.

After that, install [FMOD](https://www.fmod.com/download)
- NOTE: add ```export FMOD_LINUX_ROOT=/path/to/fmod/api/core``` in your bashrc

Then you can build, woohoo now good luck with the literal hell that is the r*blox client
