/**
 * SharedLauncher.h
 * Copyright (c) 2013 ROBLOX Corp. All Rights Reserved.
 */

#pragma once

namespace SharedLauncher
{
	static const char* FileLocationArgument = "-fileLocation";      // File to open
	static const char* ScriptArgument       = "-script";		    // Script to execute (LUA)
	static const char* AuthUrlArgument      = "-url";			    // Url to hit to authenticate (passing auth from website)
	static const char* AuthTicketArgument   = "-ticket";		    // Ticket to tack onto url to authenticate (passing auth from website)
	static const char* StartEventArgument   = "-startEvent";	    // Callback to notify launcher of start of application
    static const char* ReadyEventArgument   = "-readyEvent";	    // Callback to notify launcher that application is loaded and ready
    static const char* ShowEventArgument    = "-showEvent";	        // Event to wait for before showing the window
	static const char* TestModeArgument     = "-testMode";          // Play solo, Start Server, and Start Player
	static const char* IDEArgument          = "-ide";			    // Indicates launching studio in advanced mode (full IDE)
	static const char* BuildArgument		= "-build";			    // Indicates launching studio in build mode (limited IDE docks)
    static const char* DebuggerArgument		= "-debugger";		    // Causes the program to wait for a debugger to attach on startup
    static const char* AvatarModeArgument   = "-avatar";            // Avatar Mode sets up the in-game GUI with an avatar to run around with
	static const char* RbxDevArgument		= "-rbxdev";            // RbxDev starts the mobile development deployer (currently in development as of 1/17/2014), allows mobile devices to connect to a game
	static const char* BrowserTrackerId	= "-browserTrackerId";	// Passed in from website used to log launch status

	enum LaunchMode
	{
		Play,
		Play_Protocol,
		Build,
		Edit
	};

    struct EditArgs
	{
        std::string fileName;
		std::string authUrl;
		std::string authTicket;
		std::string script;
		std::string readyEvent;
		std::string showEventName;
        std::string launchMode;
		std::string avatarMode;
		std::string browserTrackerId;
	};

    std::wstring generateEditCommandLine(const EditArgs& editArgs);
    bool parseEditCommandArg(wchar_t** args,int& index,int count,EditArgs& editArgs);
}