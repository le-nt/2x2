#pragma once

#include <iostream>
#include <SDL2/SDL.h>
#include <boost/program_options.hpp>
#include "util/HttpAsync.h"
#include "util/standardout.h"
#include "View.h"

namespace po = boost::program_options;

namespace RBX
{
	class Application {
		enum RequestPlaceInfoResult
		{
			SUCCESS,
			FAILED,
			RETRY,
			GAME_FULL,
			USER_LEFT,
		};

		public:
			bool ParseArguments(SDL_Window* window, int argc, char* argv[]);
			void LaunchPlaceThreadImpl(const std::string& placeLauncherUrl);
			void Shutdown();
			boost::shared_ptr<View> Initialize(SDL_Window* window);
			boost::shared_ptr<RBX::Game> getPreloadedGame();
		private:
			static void onMessageOut(const StandardOutMessage& message);
			static void preloadGame();

			RequestPlaceInfoResult requestPlaceInfo(const std::string url, std::string& authenticationUrl,
				std::string& ticket,
				std::string& scriptUrl) const;

			boost::shared_ptr<View> view;
			boost::scoped_ptr<boost::thread> launchPlaceThread;

			po::variables_map vm;
			SDL_Window* mainWindow;
		};
}