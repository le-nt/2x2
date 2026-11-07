#pragma once

#include "SDL2/SDL.h"
#include "stdafx.h"
#include "UserInputUtil.h"
#include "util/UserInputBase.h"
#include "util/standardout.h"

namespace RBX {

class Game;
class DataModel;
class RunService;
class View;

class UserInput : public UserInputBase
{
	enum MouseButtonType
    {
	    MBUTTON_LEFT	= 0,
	    MBUTTON_RIGHT	= 1,
		MBUTTON_MIDDLE  = 2
    };

	rbx::event_signals::scoped_connection steppedConnection;

	std::mutex eventMutex;
	std::queue<SDL_Event> eventQueue;

	// Mouse Stuff
	bool isMouseCaptured;
	Vector2 wrapMousePosition;
	bool wrapping;
	bool rightMouseDown;
	bool autoMouseMove;
	bool mouseButtonSwap;

	bool prevLeftButtonDown = false;
	bool prevRightButtonDown = false;
	bool prevMiddleButtonDown = false;

	// Keyboard Stuff
	int externallyForcedKeyDown;

	SDL_Window* window;

	// InputObject stuff
	boost::unordered_map<RBX::InputObject::UserInputType,shared_ptr<RBX::InputObject> > inputObjectMap;

	shared_ptr<RunService> runService;

	G3D::Vector2 posToWrapTo;

	G3D::Vector2 previousCursorPosFraction;

	bool leftMouseButtonDown;

	////////////////////////////////
	//
	// Events
	void processSteppedEvents();	// called from runServiceStepped

	void processMouseEvents(SDL_Event* event);

	void sendEvent(shared_ptr<InputObject> event);
	void sendMouseEvent(InputObject::UserInputType mouseEventType,
						InputObject::UserInputState mouseEventState,
						const Vector3& position,
						const Vector3& delta);
	void handleMouseButtonStateChange(InputObject::UserInputType type, bool isDown);

	void handleMouseButtons(Uint32 mouseState);

	void handleMouseMotion(bool& cursorMoved, Vector2& wrapMouseDelta, Vector2& mouseDelta);

	void handleMouseWheel(const SDL_MouseWheelEvent* wheelEvent);

	void handleKeyboardEvent(const SDL_KeyboardEvent* keyEvent);

	////////////////////////////////////
	//
	// Keyboard Mouse
	bool isMouseAcquired;			// goes false if data read fails

	void acquireMouseInternal();

	void unAcquireMouse();

	// window stuff
	Vector2int16 getWindowSize() const;
	G3D::Rect2D getWindowRect() const;
	bool isFullScreenMode() const;
	bool movementKeysDown();
	bool keyDownInternal(SDL_Scancode code) const;

	void doWrapMouse(const G3D::Vector2& delta, G3D::Vector2& wrapMouseDelta);

	G3D::Vector2 getGameCursorPositionInternal();
	G3D::Vector2 getGameCursorPositionExpandedInternal();	// prevent hysteresis
	G3D::Vector2 getSDLCursorPositionInternal();
	Vector2 getCursorPositionInternal();

	void doDiagnostics();

	void postProcessUserInput(bool cursorMoved, const G3D::Vector2& wrapMouseDelta, const G3D::Vector2& mouseDelta);

public:
	shared_ptr<RBX::Game> game;

	////////////////////////////////
	//
	// UserInputBase

	/*implement*/ Vector2 getCursorPosition();

	/*implement*/ bool keyDown(KeyCode code) const;
	/*implement*/ void setKeyState(KeyCode code, ModCode modCode, char modifiedKey, bool isDown);

	/*implement*/ void centerCursor() { wrapMousePosition = Vector2::zero(); }

	void postUserInputMessage(SDL_Event* event);
	void processUserInputMessage(SDL_Event* event);

	UserInput(SDL_Window* window, shared_ptr<RBX::Game> game);

	void setGame(shared_ptr<RBX::Game> game);
	void onMouseInside();
	void onMouseLeave();
	
	bool getIsMouseAcquired() const { return isMouseAcquired; }

	void forceMouseUnlock();
};

}  // namespace RBX
