#pragma once

#include "v8datamodel/InputObject.h"
#include "g3d/Vector2.h"
#include <SDL2/SDL.h>

class UserInputUtil
{

public:
	static RBX::KeyCode scanCodeToKeyCode(SDL_Scancode scanCode);
	static SDL_Scancode keyCodeToScanCode(RBX::KeyCode keyCode);
	static RBX::InputObject::UserInputType buttonToEventType(Uint8 button);
	static RBX::ModCode createModCode(Uint16 mod);

	static void	wrapMouseBorderLock(const G3D::Vector2& delta,
		G3D::Vector2& wrapMouseDelta,
		G3D::Vector2& wrapMousePosition,
		const G3D::Vector2& windowSize);
	static void	wrapMouseCenter(const G3D::Vector2& delta,
		G3D::Vector2& wrapMouseDelta,
		G3D::Vector2& wrapMousePosition);
		
private:
	static void wrapMouseBorder(const G3D::Vector2& delta,
		G3D::Vector2& wrapMouseDelta,
		G3D::Vector2& wrapMousePosition,
		const G3D::Vector2& windowSize,
		const int borderWidth,
		const float creepFactor);
};