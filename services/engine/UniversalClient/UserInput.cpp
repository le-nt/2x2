#include "stdafx.h"
#include "UserInput.h"

#include "util/Rect.h"
#include "util/NavKeys.h"
#include "v8datamodel/Game.h"
#include "v8datamodel/DataModel.h"
#include "v8datamodel/DataModelJob.h"
#include "v8datamodel/GameBasicSettings.h"
#include "v8datamodel/ContentProvider.h"
#include "v8datamodel/Workspace.h"
#include "v8datamodel/UserInputService.h"
#include "humanoid/Humanoid.h"
#include "RbxG3D/RbxTime.h"
#include "g3d/System.h"
#include "g3d/Vector2.h"
#include "RenderSettingsItem.h"
#include "FastLog.h"
#include "SDL2/SDL.h"
#include "util/KeyCode.h"

LOGGROUP(UserInputProfile)
DYNAMIC_FASTFLAGVARIABLE(MouseDeltaWhenNotMouseLocked, false)
DYNAMIC_FASTFLAGVARIABLE(UserInputViewportSizeFixWindows, true)
FASTFLAG(UserAllCamerasInLua)

namespace RBX {

UserInput::UserInput(SDL_Window* window, shared_ptr<RBX::Game> game)
    : externallyForcedKeyDown(SDL_SCANCODE_UNKNOWN)
    , isMouseCaptured(false)
    , isMouseAcquired(false)
    , window(window)
    , wrapping(false)
    , posToWrapTo(0, 0)
    , leftMouseButtonDown(false)
    , rightMouseDown(false)
    , prevLeftButtonDown(false)
    , prevRightButtonDown(false)
    , prevMiddleButtonDown(false)
    , autoMouseMove(true)
    , mouseButtonSwap(false)
{
    setGame(game);
}

void UserInput::setGame(shared_ptr<RBX::Game> game)
{
    this->game = game;
    runService = shared_from(ServiceProvider::create<RunService>(game->getDataModel().get()));
    shared_ptr<DataModel> dataModel = game->getDataModel();
    steppedConnection = runService->earlyRenderSignal.connect(
        boost::bind(&UserInput::processSteppedEvents, this)
    );
}

void UserInput::acquireMouseInternal()
{
    if (!isMouseAcquired) 
    {
        isMouseAcquired = true;
        SDL_SetRelativeMouseMode(SDL_TRUE);
    }
}

void UserInput::unAcquireMouse()
{
    if (isMouseAcquired)
    {
        isMouseAcquired = false;
        SDL_SetRelativeMouseMode(SDL_FALSE);
    }
}

void UserInput::forceMouseUnlock()
{
    if (isMouseAcquired)
    {
        isMouseAcquired = false;
    }
}

void UserInput::postUserInputMessage(SDL_Event* event) 
{
    std::lock_guard<std::mutex> lock(eventMutex);
    eventQueue.push(*event);
}

void UserInput::processUserInputMessage(SDL_Event* event) 
{
    switch (event->type) 
    {
    case SDL_WINDOWEVENT:
        if (event->window.event == SDL_WINDOWEVENT_FOCUS_GAINED) {
            SDL_SetRelativeMouseMode(SDL_TRUE);
            SDL_SetWindowGrab(window, SDL_TRUE);
        } else if (event->window.event == SDL_WINDOWEVENT_FOCUS_LOST) {
            SDL_SetRelativeMouseMode(SDL_FALSE);
            SDL_SetWindowGrab(window, SDL_FALSE);
        }
        break;
    case SDL_MOUSEWHEEL:
        processMouseEvents(event);
        break;
    case SDL_KEYDOWN:
    case SDL_KEYUP:
        handleKeyboardEvent(&event->key);
        break;
    }
}

void UserInput::processSteppedEvents() 
{
    {
        std::lock_guard<std::mutex> lock(eventMutex);
        while (!eventQueue.empty()) 
        {
            processUserInputMessage(&eventQueue.front());
            eventQueue.pop();
        }
    }

    SDL_PumpEvents();

    bool cursorMoved = false;
    G3D::Vector2 wrapMouseDelta;
    int x, y;

    Uint32 mouseState = SDL_GetRelativeMouseState(&x, &y);
    G3D::Vector2 mouseDelta(static_cast<float>(x), static_cast<float>(y));

    handleMouseButtons(mouseState);
    handleMouseMotion(cursorMoved, wrapMouseDelta, mouseDelta);
    postProcessUserInput(cursorMoved, wrapMouseDelta, mouseDelta);
}

void UserInput::processMouseEvents(SDL_Event* event)
{
    switch (event->type) 
    {
    case SDL_MOUSEWHEEL:
        handleMouseWheel(&event->wheel);
        break;
    }
}

void UserInput::handleMouseButtons(Uint32 mouseState) 
{
    bool currentLeft = (mouseState & SDL_BUTTON(SDL_BUTTON_LEFT)) != 0;
    bool currentRight = (mouseState & SDL_BUTTON(SDL_BUTTON_RIGHT)) != 0;
    bool currentMiddle = (mouseState & SDL_BUTTON(SDL_BUTTON_MIDDLE)) != 0;

    leftMouseButtonDown = currentLeft;
    rightMouseDown = currentRight;

    if (currentLeft != prevLeftButtonDown) 
    {
        handleMouseButtonStateChange(InputObject::TYPE_MOUSEBUTTON1, currentLeft);
        prevLeftButtonDown = currentLeft;
    }
    if (currentRight != prevRightButtonDown) 
    {
        handleMouseButtonStateChange(InputObject::TYPE_MOUSEBUTTON2, currentRight);
        prevRightButtonDown = currentRight;
    }
    if (currentMiddle != prevMiddleButtonDown) 
    {
        handleMouseButtonStateChange(InputObject::TYPE_MOUSEBUTTON3, currentMiddle);
        prevMiddleButtonDown = currentMiddle;
    }
}

void UserInput::doWrapMouse(const G3D::Vector2& delta, G3D::Vector2& wrapMouseDelta)
{
    if (auto* userInputService = ServiceProvider::find<UserInputService>(game->getDataModel().get()))
    {
        switch (userInputService->getMouseWrapMode())
        {
        case UserInputService::WRAP_NONEANDCENTER:
            acquireMouseInternal();
            centerCursor();
            break;
        case UserInputService::WRAP_NONE:
        case UserInputService::WRAP_CENTER:
            acquireMouseInternal();
            UserInputUtil::wrapMouseCenter(delta, wrapMouseDelta, this->wrapMousePosition);
            break;
        case UserInputService::WRAP_HYBRID:
        case UserInputService::WRAP_AUTO:
        #ifndef EMSCRIPTEN
            if (isMouseAcquired)
                unAcquireMouse();
        #endif

            if (!GameBasicSettings::singleton().inMousepanMode())
            {
            #ifdef EMSCRIPTEN
                acquireMouseInternal();
            #endif
                UserInputUtil::wrapMouseBorderLock(delta, wrapMouseDelta, this->wrapMousePosition, getWindowSize());
            }
        #ifdef EMSCRIPTEN
            else
            {
                unAcquireMouse();
            }
        #endif
            break;
        }
    }

    if (isMouseAcquired) 
    {
        Vector2 pos = getGameCursorPositionInternal();
        SDL_WarpMouseInWindow(window, static_cast<int>(pos.x), static_cast<int>(pos.y));
    }
    else 
    {
        wrapMousePosition = getSDLCursorPositionInternal() - getWindowRect().center();
    }
}

void UserInput::handleMouseButtonStateChange(InputObject::UserInputType type, bool isDown)
{
    InputObject::UserInputState state = isDown ? InputObject::INPUT_STATE_BEGIN : InputObject::INPUT_STATE_END;
    Vector2 cursorPos = getCursorPositionInternal();
    sendMouseEvent(type, state, G3D::Vector3(cursorPos, 0), G3D::Vector3::zero());
}

void UserInput::handleMouseMotion(bool& cursorMoved, Vector2& wrapMouseDelta, Vector2& mouseDelta)
{
    previousCursorPosFraction += mouseDelta;
    mouseDelta.x = static_cast<int>(previousCursorPosFraction.x);
    mouseDelta.y = static_cast<int>(previousCursorPosFraction.y);
    previousCursorPosFraction -= mouseDelta;

    doWrapMouse(mouseDelta, wrapMouseDelta);
    cursorMoved = (mouseDelta.x != 0 || mouseDelta.y != 0);
}

void UserInput::handleMouseWheel(const SDL_MouseWheelEvent* wheelEvent)
{
    const float deltaY = wheelEvent->y;
    if (deltaY == 0.0f)
    {
        return;
    }
    const Vector2 cursorPos = getCursorPositionInternal();
    RBX::Vector3 position(cursorPos, deltaY);
    RBX::Vector3 delta = G3D::Vector3::zero();
    sendMouseEvent(InputObject::TYPE_MOUSEWHEEL, InputObject::INPUT_STATE_CHANGE, position, delta);
}

void UserInput::handleKeyboardEvent(const SDL_KeyboardEvent* keyEvent)
{
    const bool down = (keyEvent->type == SDL_KEYDOWN);
    KeyCode keyCode = UserInputUtil::scanCodeToKeyCode(keyEvent->keysym.scancode);
    ModCode modCode = UserInputUtil::createModCode(keyEvent->keysym.mod);
    const char finalChar = UserInputService::getModifiedKey(keyCode, modCode);

    if (auto* userInputService = ServiceProvider::find<UserInputService>(game->getDataModel().get()))
    {
        userInputService->setKeyState(keyCode, modCode, finalChar, down);
    }

    InputObject::UserInputState eventState = down ? InputObject::INPUT_STATE_BEGIN : InputObject::INPUT_STATE_END;
    shared_ptr<InputObject> keyInput = Creatable<Instance>::create<InputObject>(
        InputObject::TYPE_KEYBOARD, eventState, keyCode, modCode, finalChar, game->getDataModel().get());
    
    sendEvent(keyInput);
}

void UserInput::postProcessUserInput(bool cursorMoved, const G3D::Vector2& wrapMouseDelta, const G3D::Vector2& mouseDelta)
{
    if (auto* userInputService = ServiceProvider::find<UserInputService>(game->getDataModel().get()))
    {
        if (GameBasicSettings::singleton().inMousepanMode())
        {
            if (leftMouseButtonDown && GameBasicSettings::singleton().getCanMousePan())
                userInputService->setMouseWrapMode(UserInputService::WRAP_CENTER);
            else if (!rightMouseDown)
                userInputService->setMouseWrapMode(UserInputService::WRAP_AUTO);
        }
    }

    if (wrapMouseDelta != Vector2::zero())
    {
        if (auto* workspace = game->getDataModel()->getWorkspace())
        {
            if (auto* camera = workspace->getCamera())
            {
                if (!(FFlag::UserAllCamerasInLua && camera->hasClientPlayer()) && camera->getCameraType() != Camera::CUSTOM_CAMERA)
                {
                    workspace->onWrapMouse(mouseDelta);
                }
            }
        }
        
        Vector3 currentPos(getCursorPositionInternal(), 0);
        Vector3 delta(wrapMouseDelta.x, wrapMouseDelta.y, 0);
        sendMouseEvent(InputObject::TYPE_MOUSEDELTA, InputObject::INPUT_STATE_CHANGE, currentPos, delta);
        sendMouseEvent(InputObject::TYPE_MOUSEMOVEMENT, InputObject::INPUT_STATE_CHANGE, currentPos, delta);
    }
    else if (cursorMoved)
    {
        Vector3 currentPos(getCursorPositionInternal(), 0);
        Vector3 delta(mouseDelta.x, mouseDelta.y, 0);
        sendMouseEvent(InputObject::TYPE_MOUSEMOVEMENT, InputObject::INPUT_STATE_CHANGE, currentPos, delta);
    }
}

void UserInput::sendMouseEvent(InputObject::UserInputType mouseEventType, 
                                 InputObject::UserInputState mouseEventState,
                                 const Vector3& position,
                                 const Vector3& delta)
{
    FASTLOG1(FLog::UserInputProfile, "Processing mouse event from the queue, event: %u", mouseEventType);
    
    shared_ptr<InputObject> mouseEventObject = inputObjectMap[mouseEventType];
    if (!mouseEventObject)
    {
        mouseEventObject = Creatable<Instance>::create<InputObject>(
            mouseEventType, mouseEventState, position, delta, game->getDataModel().get());
        inputObjectMap[mouseEventType] = mouseEventObject;
    }
    else
    {
        mouseEventObject->setInputState(mouseEventState);
        mouseEventObject->setPosition(position);
        mouseEventObject->setDelta(delta);
    }
    
    sendEvent(mouseEventObject);
}

void UserInput::sendEvent(shared_ptr<InputObject> event)
{
    if (auto* userInputService = ServiceProvider::find<UserInputService>(game->getDataModel().get()))
    {
        userInputService->fireInputEvent(event, NULL);
    }
}

bool UserInput::isFullScreenMode() const
{
    return false;
}

G3D::Rect2D UserInput::getWindowRect() const
{
    int w, h;
    SDL_GetWindowSize(window, &w, &h);
    return Rect2D::xywh(0, 0, w, h);
}

G3D::Vector2int16 UserInput::getWindowSize() const
{
    G3D::Rect2D windowRect = getWindowRect();
    return G3D::Vector2int16(windowRect.width(), windowRect.height());
}

bool UserInput::movementKeysDown()
{
    return keyDownInternal(SDL_SCANCODE_W) || keyDownInternal(SDL_SCANCODE_S) ||
           keyDownInternal(SDL_SCANCODE_A) || keyDownInternal(SDL_SCANCODE_D) ||
           keyDownInternal(SDL_SCANCODE_UP) || keyDownInternal(SDL_SCANCODE_DOWN) ||
           keyDownInternal(SDL_SCANCODE_LEFT) || keyDownInternal(SDL_SCANCODE_RIGHT);
}

G3D::Vector2 UserInput::getGameCursorPositionInternal()
{
    return getWindowRect().center() + wrapMousePosition;
}

G3D::Vector2 UserInput::getSDLCursorPositionInternal()
{
    int x, y;
    SDL_GetMouseState(&x, &y);
    return G3D::Vector2(static_cast<float>(x), static_cast<float>(y));
}

G3D::Vector2 UserInput::getCursorPosition()
{
    return getCursorPositionInternal();
}

G3D::Vector2 UserInput::getCursorPositionInternal()
{
    return isMouseAcquired ? getGameCursorPositionInternal() : getSDLCursorPositionInternal();
}

bool UserInput::keyDown(KeyCode code) const
{
    return keyDownInternal(UserInputUtil::keyCodeToScanCode(code));
}

bool UserInput::keyDownInternal(SDL_Scancode scancode) const
{
    if (externallyForcedKeyDown != SDL_SCANCODE_UNKNOWN && scancode == externallyForcedKeyDown) 
    {
        return true;
    }

    const Uint8* keyboardState = SDL_GetKeyboardState(nullptr);
    if (!keyboardState) 
    {
        return false;
    }

    return keyboardState[scancode];
}

void UserInput::setKeyState(KeyCode code, ModCode modCode, char modifiedKey, bool isDown)
{
    externallyForcedKeyDown = isDown ? UserInputUtil::keyCodeToScanCode(code) : SDL_SCANCODE_UNKNOWN;
}


void UserInput::doDiagnostics()
{
    static int errorCount = 0;
    static bool haveFailed = false;

    if (isMouseAcquired)
    {
        if (haveFailed && errorCount > 0)
        {
            errorCount = 0;
        }
        haveFailed = false;
    }
    else
    {
        static G3D::RealTime nextMessage = G3D::System::time();
        ++errorCount;
        haveFailed = true;
        if (nextMessage <= G3D::System::time())
        {
            errorCount = 0;
            nextMessage = G3D::System::time() + 10.0f;
        }
    }
}

} // namespace RBX