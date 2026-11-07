#include "stdafx.h"
#include "UserInputUtil.h"
#include "util/Rect.h"
#include "v8datamodel/GameBasicSettings.h"

SDL_Scancode UserInputUtil::keyCodeToScanCode(RBX::KeyCode keyCode)
{
    static SDL_Scancode reverseKeymap[512];
    static bool initialized = false;

    if (!initialized)
    {
        for (int i = 0; i < 512; ++i)
            reverseKeymap[i] = SDL_SCANCODE_UNKNOWN;

        for (int scancode = 0; scancode < 256; ++scancode)
        {
            RBX::KeyCode code = UserInputUtil::scanCodeToKeyCode(static_cast<SDL_Scancode>(scancode));
            if (code != RBX::SDLK_UNKNOWN)
                reverseKeymap[code] = static_cast<SDL_Scancode>(scancode);
        }

        initialized = true;
    }

    return reverseKeymap[keyCode];
}


RBX::KeyCode UserInputUtil::scanCodeToKeyCode(SDL_Scancode scanCode)
{
	static RBX::KeyCode keymap[256];
	static bool initialized = false;
	if (!initialized)
	{
		for (int i = 0; i < 256; ++i)
			keymap[i] = RBX::SDLK_UNKNOWN;

		keymap[SDL_SCANCODE_ESCAPE] = RBX::SDLK_ESCAPE;
		keymap[SDL_SCANCODE_1] = RBX::SDLK_1;
		keymap[SDL_SCANCODE_2] = RBX::SDLK_2;
		keymap[SDL_SCANCODE_3] = RBX::SDLK_3;
		keymap[SDL_SCANCODE_4] = RBX::SDLK_4;
		keymap[SDL_SCANCODE_5] = RBX::SDLK_5;
		keymap[SDL_SCANCODE_6] = RBX::SDLK_6;
		keymap[SDL_SCANCODE_7] = RBX::SDLK_7;
		keymap[SDL_SCANCODE_8] = RBX::SDLK_8;
		keymap[SDL_SCANCODE_9] = RBX::SDLK_9;
		keymap[SDL_SCANCODE_0] = RBX::SDLK_0;
		keymap[SDL_SCANCODE_MINUS] = RBX::SDLK_MINUS;
		keymap[SDL_SCANCODE_EQUALS] = RBX::SDLK_EQUALS;
		keymap[SDL_SCANCODE_BACKSPACE] = RBX::SDLK_BACKSPACE;
		keymap[SDL_SCANCODE_TAB] = RBX::SDLK_TAB;
		keymap[SDL_SCANCODE_Q] = RBX::SDLK_q;
		keymap[SDL_SCANCODE_W] = RBX::SDLK_w;
		keymap[SDL_SCANCODE_E] = RBX::SDLK_e;
		keymap[SDL_SCANCODE_R] = RBX::SDLK_r;
		keymap[SDL_SCANCODE_T] = RBX::SDLK_t;
		keymap[SDL_SCANCODE_Y] = RBX::SDLK_y;
		keymap[SDL_SCANCODE_U] = RBX::SDLK_u;
		keymap[SDL_SCANCODE_I] = RBX::SDLK_i;
		keymap[SDL_SCANCODE_O] = RBX::SDLK_o;
		keymap[SDL_SCANCODE_P] = RBX::SDLK_p;

		keymap[SDL_SCANCODE_LEFTBRACKET] = RBX::SDLK_LEFTBRACKET;
		keymap[SDL_SCANCODE_NONUSHASH] = RBX::SDLK_AT;
		keymap[SDL_SCANCODE_RIGHTBRACKET] = RBX::SDLK_RIGHTBRACKET;
		keymap[SDL_SCANCODE_EQUALS] = RBX::SDLK_EQUALS;
		keymap[SDL_SCANCODE_SEMICOLON] = RBX::SDLK_COLON;
		keymap[SDL_SCANCODE_GRAVE] = RBX::SDLK_BACKQUOTE;

		keymap[SDL_SCANCODE_RETURN] = RBX::SDLK_RETURN;
		keymap[SDL_SCANCODE_LCTRL] = RBX::SDLK_LCTRL;
		keymap[SDL_SCANCODE_A] = RBX::SDLK_a;
		keymap[SDL_SCANCODE_S] = RBX::SDLK_s;
		keymap[SDL_SCANCODE_D] = RBX::SDLK_d;
		keymap[SDL_SCANCODE_F] = RBX::SDLK_f;
		keymap[SDL_SCANCODE_G] = RBX::SDLK_g;
		keymap[SDL_SCANCODE_H] = RBX::SDLK_h;
		keymap[SDL_SCANCODE_J] = RBX::SDLK_j;
		keymap[SDL_SCANCODE_K] = RBX::SDLK_k;
		keymap[SDL_SCANCODE_L] = RBX::SDLK_l;
		keymap[SDL_SCANCODE_SEMICOLON] = RBX::SDLK_SEMICOLON;
		keymap[SDL_SCANCODE_APOSTROPHE] = RBX::SDLK_QUOTE;
		keymap[SDL_SCANCODE_GRAVE] = RBX::SDLK_BACKQUOTE;
		keymap[SDL_SCANCODE_LSHIFT] = RBX::SDLK_LSHIFT;
		keymap[SDL_SCANCODE_BACKSLASH] = RBX::SDLK_BACKSLASH;
		keymap[SDL_SCANCODE_NONUSHASH] = RBX::SDLK_BACKSLASH;
		keymap[SDL_SCANCODE_Z] = RBX::SDLK_z;
		keymap[SDL_SCANCODE_X] = RBX::SDLK_x;
		keymap[SDL_SCANCODE_C] = RBX::SDLK_c;
		keymap[SDL_SCANCODE_V] = RBX::SDLK_v;
		keymap[SDL_SCANCODE_B] = RBX::SDLK_b;
		keymap[SDL_SCANCODE_N] = RBX::SDLK_n;
		keymap[SDL_SCANCODE_M] = RBX::SDLK_m;
		keymap[SDL_SCANCODE_COMMA] = RBX::SDLK_COMMA;
		keymap[SDL_SCANCODE_PERIOD] = RBX::SDLK_PERIOD;
		keymap[SDL_SCANCODE_SLASH] = RBX::SDLK_SLASH;
		keymap[SDL_SCANCODE_RSHIFT] = RBX::SDLK_RSHIFT;
		keymap[SDL_SCANCODE_KP_MULTIPLY] = RBX::SDLK_KP_MULTIPLY;
		keymap[SDL_SCANCODE_LALT] = RBX::SDLK_LALT;
		keymap[SDL_SCANCODE_SPACE] = RBX::SDLK_SPACE;
		keymap[SDL_SCANCODE_CAPSLOCK] = RBX::SDLK_CAPSLOCK;
		keymap[SDL_SCANCODE_F1] = RBX::SDLK_F1;
		keymap[SDL_SCANCODE_F2] = RBX::SDLK_F2;
		keymap[SDL_SCANCODE_F3] = RBX::SDLK_F3;
		keymap[SDL_SCANCODE_F4] = RBX::SDLK_F4;
		keymap[SDL_SCANCODE_F5] = RBX::SDLK_F5;
		keymap[SDL_SCANCODE_F6] = RBX::SDLK_F6;
		keymap[SDL_SCANCODE_F7] = RBX::SDLK_F7;
		keymap[SDL_SCANCODE_F8] = RBX::SDLK_F8;
		keymap[SDL_SCANCODE_F9] = RBX::SDLK_F9;
		keymap[SDL_SCANCODE_F10] = RBX::SDLK_F10;
		keymap[SDL_SCANCODE_NUMLOCKCLEAR] = RBX::SDLK_NUMLOCK;
		keymap[SDL_SCANCODE_SCROLLLOCK] = RBX::SDLK_SCROLLOCK;
		keymap[SDL_SCANCODE_KP_7] = RBX::SDLK_KP7;
		keymap[SDL_SCANCODE_KP_8] = RBX::SDLK_KP8;
		keymap[SDL_SCANCODE_KP_9] = RBX::SDLK_KP9;
		keymap[SDL_SCANCODE_KP_MINUS] = RBX::SDLK_KP_MINUS;
		keymap[SDL_SCANCODE_KP_4] = RBX::SDLK_KP4;
		keymap[SDL_SCANCODE_KP_5] = RBX::SDLK_KP5;
		keymap[SDL_SCANCODE_KP_6] = RBX::SDLK_KP6;
		keymap[SDL_SCANCODE_KP_PLUS] = RBX::SDLK_KP_PLUS;
		keymap[SDL_SCANCODE_KP_1] = RBX::SDLK_KP1;
		keymap[SDL_SCANCODE_KP_2] = RBX::SDLK_KP2;
		keymap[SDL_SCANCODE_KP_3] = RBX::SDLK_KP3;
		keymap[SDL_SCANCODE_KP_0] = RBX::SDLK_KP0;
		keymap[SDL_SCANCODE_KP_DECIMAL] = RBX::SDLK_KP_PERIOD;
		keymap[SDL_SCANCODE_F11] = RBX::SDLK_F11;
		keymap[SDL_SCANCODE_F12] = RBX::SDLK_F12;
		keymap[SDL_SCANCODE_F13] = RBX::SDLK_F13;
		keymap[SDL_SCANCODE_F14] = RBX::SDLK_F14;
		keymap[SDL_SCANCODE_F15] = RBX::SDLK_F15;
		keymap[SDL_SCANCODE_KP_EQUALS] = RBX::SDLK_KP_EQUALS;
		keymap[SDL_SCANCODE_KP_ENTER] = RBX::SDLK_KP_ENTER;
		keymap[SDL_SCANCODE_RCTRL] = RBX::SDLK_RCTRL;
		keymap[SDL_SCANCODE_KP_DIVIDE] = RBX::SDLK_KP_DIVIDE;
		keymap[SDL_SCANCODE_PRINTSCREEN] = RBX::SDLK_SYSREQ;
		keymap[SDL_SCANCODE_RALT] = RBX::SDLK_RALT;
		keymap[SDL_SCANCODE_PAUSE] = RBX::SDLK_PAUSE;
		keymap[SDL_SCANCODE_HOME] = RBX::SDLK_HOME;
		keymap[SDL_SCANCODE_UP] = RBX::SDLK_UP;
		keymap[SDL_SCANCODE_PAGEUP] = RBX::SDLK_PAGEUP;
		keymap[SDL_SCANCODE_LEFT] = RBX::SDLK_LEFT;
		keymap[SDL_SCANCODE_RIGHT] = RBX::SDLK_RIGHT;
		keymap[SDL_SCANCODE_END] = RBX::SDLK_END;
		keymap[SDL_SCANCODE_DOWN] = RBX::SDLK_DOWN;
		keymap[SDL_SCANCODE_PAGEDOWN] = RBX::SDLK_PAGEDOWN;
		keymap[SDL_SCANCODE_INSERT] = RBX::SDLK_INSERT;
		keymap[SDL_SCANCODE_DELETE] = RBX::SDLK_DELETE;
		keymap[SDL_SCANCODE_LGUI] = RBX::SDLK_LMETA;
		keymap[SDL_SCANCODE_RGUI] = RBX::SDLK_RMETA;
		keymap[SDL_SCANCODE_APPLICATION] = RBX::SDLK_MENU;
		initialized = true;
	}

	return keymap[scanCode];
}

RBX::InputObject::UserInputType UserInputUtil::buttonToEventType(Uint8 button)
{
	switch (button)
	{
	case SDL_BUTTON_LEFT:
		return RBX::InputObject::TYPE_MOUSEBUTTON1;
	case SDL_BUTTON_RIGHT:
		return RBX::InputObject::TYPE_MOUSEBUTTON2;
	case SDL_BUTTON_MIDDLE:
		return RBX::InputObject::TYPE_MOUSEBUTTON3;
	default:
		return RBX::InputObject::TYPE_NONE;
	}
}

RBX::ModCode UserInputUtil::createModCode(Uint16 mod)
{
	unsigned int modCode = 0;

	if (mod & KMOD_LSHIFT)
	{
		modCode = modCode | RBX::KMOD_LSHIFT;
	}
	if (mod & KMOD_RSHIFT)
	{
		modCode = modCode | RBX::KMOD_RSHIFT;
	}
	if (mod & KMOD_LCTRL)
	{
		modCode = modCode | RBX::KMOD_LCTRL;
	}
	if (mod & KMOD_RCTRL)
	{
		modCode = modCode | RBX::KMOD_RCTRL;
	}
	if (mod & KMOD_LALT)
	{
		modCode = modCode | RBX::KMOD_LALT;
	}
	if (mod & KMOD_RALT)
	{
		modCode = modCode | RBX::KMOD_RALT;
	}
	if (mod & KMOD_CAPS)
	{
		modCode = modCode | RBX::KMOD_CAPS;
	}

	return (RBX::ModCode)modCode;
}

void UserInputUtil::wrapMouseCenter(const G3D::Vector2& delta,
	G3D::Vector2& wrapMouseDelta,
	G3D::Vector2& wrapMousePosition)
{
	wrapMouseDelta += delta * RBX::GameBasicSettings::singleton().getMouseSensitivity();
}


void UserInputUtil::wrapMouseBorderLock(const G3D::Vector2& delta,
	G3D::Vector2& wrapMouseDelta,
	G3D::Vector2& wrapMousePosition,
	const G3D::Vector2& windowSize)
{
	wrapMouseBorder(
		delta,
		wrapMouseDelta,
		wrapMousePosition,
		windowSize,
		6,
		0.0f);
}

void UserInputUtil::wrapMouseBorder(const G3D::Vector2& delta,
	G3D::Vector2& wrapMouseDelta,
	G3D::Vector2& wrapMousePosition,
	const G3D::Vector2& windowSize,
	const int borderWidth,
	const float creepFactor)
{
	G3D::Vector2 halfSize = windowSize * 0.5;
	RBX::Rect inner = RBX::Rect(-halfSize, halfSize).inset(borderWidth);	// in Wrap Coordinates
	G3D::Vector2 oldPosition = wrapMousePosition;
	inner.unionWith(oldPosition);					// now union of the border and old position - ratchet

	G3D::Vector2 newPositionUnclamped = oldPosition + delta;
	G3D::Vector2 newPositionClamped = inner.clamp(newPositionUnclamped);

	G3D::Vector2 positiveDistanceInBorder = newPositionUnclamped - newPositionClamped;

	if (!RBX::GameBasicSettings::singleton().inMousepanMode())
		wrapMousePosition = newPositionClamped + (positiveDistanceInBorder * creepFactor);
	wrapMouseDelta += positiveDistanceInBorder;
}