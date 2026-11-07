#pragma once

#include "boost/shared_ptr.hpp"
#include "boost/scoped_ptr.hpp"
#include "boost/thread.hpp"
#include "v8datamodel/Game.h"
#include "GfxBase/ViewBase.h"
#include "util/KeyCode.h"
#include "g3d/Vector2.h"
#include "rbx/signal.h"
#include <SDL2/SDL.h>
#include "FunctionMarshaller.h"
#include "util/HttpAsync.h"

namespace RBX
{
	class Game;
	struct OSContext;
	class RenderJob;
	class ViewBase;

	namespace Tasks
	{
		class Sequence;
	}
	
	namespace Reflection
	{
		class PropertyDescriptor;
	}

	class View
	{

	public:
		View(SDL_Window* window);

		void doShutdownDataModel();
		void stopJobs();

		void Start(const shared_ptr<RBX::Game>& game);
		void Stop();

		boost::shared_ptr<DataModel> getDataModel() { return game ? game->getDataModel() : boost::shared_ptr<RBX::DataModel>(); }
		ViewBase* GetGfxView() const { return view.get(); }
		FunctionMarshaller* GetMarshaller() const { return marshaller;  }

		void ExecuteScript(std::string scriptUrl, int launchMode);
		void SetUiMessage(const std::string& message);
		boost::shared_ptr<RenderJob> renderJob;
	private:
		boost::scoped_ptr<ViewBase> view;
		boost::shared_ptr<Game> game;
		OSContext context;

		FunctionMarshaller* marshaller;

		void bindWorkspace();
		void initializeJobs();
		void resetScheduler();

		void removeJobs();
		void unbindWorkspace();
	};

}