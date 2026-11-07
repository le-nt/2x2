#include <iostream>
#include <thread>
#include <atomic>
#include <SDL2/SDL.h>
#include "Application.h"
#include "util/Statistics.h"
#include "UserInput.h"
#include "View.h"
#include "v8datamodel/BaseRenderJob.h"
#include "RenderSettingsItem.h"
#include "VirtualizerSDK.h"
#include "StealthCodeArea.h"

#ifdef EMSCRIPTEN
#include "emscripten.h"
#endif

int stealthVar = 0;
std::atomic<bool> isRunning(true);
boost::scoped_ptr<RBX::UserInput> input;
boost::shared_ptr<RBX::View> view;
static SDL_Event e;

#ifdef EMSCRIPTEN
extern "C" {
    EMSCRIPTEN_KEEPALIVE
    void notifyPointerLockLost() {
        if (input) {
            input->forceMouseUnlock();
        }
    }
}
#endif

void main_loop() {
	while (SDL_PollEvent(&e)) {
		switch (e.type) {
			case SDL_QUIT:
				isRunning = false;
				break;
			case SDL_KEYDOWN:
			case SDL_KEYUP:
			case SDL_MOUSEMOTION:
			case SDL_MOUSEBUTTONUP:
			case SDL_MOUSEBUTTONDOWN:
			case SDL_MOUSEWHEEL:
				input->postUserInputMessage(&e);
				break;

		}
	}
	view->GetMarshaller()->ProcessJobs();
}

STEALTH_AUX_FUNCTION
void stealth_area(void)
{
    STEALTH_AREA_START

    STEALTH_AREA_CHUNK
    STEALTH_AREA_CHUNK
    STEALTH_AREA_CHUNK
    STEALTH_AREA_CHUNK
    STEALTH_AREA_CHUNK
    STEALTH_AREA_CHUNK
    STEALTH_AREA_CHUNK
    STEALTH_AREA_CHUNK
    STEALTH_AREA_CHUNK
    STEALTH_AREA_CHUNK
    STEALTH_AREA_CHUNK
    STEALTH_AREA_CHUNK
    STEALTH_AREA_CHUNK
    
    STEALTH_AREA_END
}

int main(int argc, char* argv[]) {
	// prevent compiler from removing stealth area
    if (stealthVar == 0x11223344)
    {
        stealth_area();
    }

	// proceed with client start
	std::cout << "Starting UniversalClient..." << std::endl;

	if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_TIMER) != 0) {
		std::cerr << "SDL_Init error: " << SDL_GetError() << "\n";
		return 1;
	}

	SDL_Window* window = SDL_CreateWindow(
		"ROBLOX",
		SDL_WINDOWPOS_CENTERED,
		SDL_WINDOWPOS_CENTERED,
		800,
		600,
		SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_HIDDEN
	);
	SDL_ShowCursor(SDL_DISABLE);

	if (!window) {
		std::cerr << "Failed to create SDL window: " << SDL_GetError() << "\n";
		SDL_Quit();
		return 1;
	}

	RBX::Application app;
	if (!app.ParseArguments(window, argc, argv)) {
		SDL_DestroyWindow(window);
		SDL_Quit();
		return 1;
	}

	view = app.Initialize(window);
	if (!view) {
		std::cerr << "Failed to initialize app\n";
		return 0;
	}
	input.reset(new RBX::UserInput(window, app.getPreloadedGame()));

	#ifdef EMSCRIPTEN
		emscripten_set_main_loop(main_loop, 0, true);
	#else
		while (isRunning) {
			main_loop();
		}
		app.Shutdown();
		SDL_DestroyWindow(window);
		SDL_Quit();
	#endif

	return 0;
}