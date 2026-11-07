#include "View.h"
#include "v8datamodel/DataModel.h"
#include "v8datamodel/Workspace.h"
#include "v8datamodel/Camera.h"
#include "v8datamodel/Game.h"
#include "v8datamodel/InputObject.h"
#include "v8datamodel/GuiService.h"
#include "FunctionMarshaller.h"
#include "util/standardout.h"
#include "util/FileSystem.h"
#include "rbx/SystemUtil.h"
#include "rbx/Tasks/Coordinator.h"
#include "util/IMetric.h"
#include "util/Object.h"
#include "GfxBase/RenderSettings.h"
#include "GfxBase/FrameRateManager.h"
#include "v8datamodel/BaseRenderJob.h"
#include "v8datamodel/UserController.h"
#include "v8datamodel/UserInputService.h"
#include "util/Statistics.h"
#include "v8datamodel/ContentProvider.h"
#include "script/ScriptContext.h"
#include "v8xml/Serializer.h"
#include "rbx/CEvent.h"
#include "network/Players.h"
#include "../ClientBase/RenderSettingsItem.h"
#include "RenderJob.h"
#include "UserInputUtil.h"

#include <boost/iostreams/copy.hpp>

#include "v8datamodel/GameBasicSettings.h"

namespace RBX
{
	View::View(SDL_Window* window)
	{
		context.hWnd = window;
		marshaller = new FunctionMarshaller();

		RBX::CRenderSettings& settings = CRenderSettingsItem::singleton();
		RBX::CRenderSettings::GraphicsMode mode = RBX::CRenderSettings::OpenGL;

		ViewBase::InitPluginModules();
		view.reset(ViewBase::CreateView(mode, &context, &settings));
		view->initResources();

		G3D::Vector2int16 fullscreenSize;
		fullscreenSize.x = 800;
		fullscreenSize.y = 600;

		CRenderSettingsItem::singleton().setWindowSize(fullscreenSize);
		CRenderSettingsItem::singleton().setFullscreenSize(fullscreenSize);
	}

	void View::bindWorkspace()
	{
		shared_ptr<DataModel> dm = getDataModel();
		DataModel::LegacyLock lock(dm, DataModelJob::Write);
		view->bindWorkspace(game->getDataModel());
		view->buildGui();
	}

	void View::unbindWorkspace()
	{
		shared_ptr<DataModel> dm = getDataModel();
		DataModel::LegacyLock lock(dm, DataModelJob::Write);
		view->bindWorkspace(boost::shared_ptr<DataModel>());
	}

	void View::initializeJobs()
	{
		shared_ptr<DataModel> dataModel = game->getDataModel();
		renderJob.reset(new RenderJob(this, marshaller, dataModel));
	}

	void View::removeJobs()
	{
		if (renderJob)
		{
			boost::function<void()> callback =
				boost::bind(&FunctionMarshaller::ProcessJobs, marshaller);
			TaskScheduler::singleton().removeBlocking(renderJob, callback);
		}
		marshaller->ProcessJobs();
		renderJob.reset();
	}

	void View::resetScheduler()
	{
		TaskScheduler& taskScheduler = TaskScheduler::singleton();
		taskScheduler.add(renderJob);
	}

	static void setUiMessageImpl(shared_ptr<DataModel> dm, const std::string& message)
	{
		if (message.length() > 0)
		{
			dm->setUiMessage(message);
		}
		else
		{
			dm->clearUiMessage();
		}

		if (GuiService*gs = dm->create<GuiService>())
			gs->setUiMessage(GuiService::UIMESSAGE_INFO, message);
	}

	void View::SetUiMessage(const std::string& message)
	{
		if (shared_ptr<DataModel> dm = game->getDataModel())
		{
			dm->submitTask(boost::bind(setUiMessageImpl, dm, message), DataModelJob::Write);
		}
	}

	void View::Start(const shared_ptr<Game>& game)
	{
		StandardOut::singleton()->printf(RBX::MESSAGE_INFO, "Starting view...");
		RBXASSERT(!this->game);
		this->game = game;

		bindWorkspace();
		initializeJobs();
		resetScheduler();
	}

	void View::Stop()
	{
		RBXASSERT(this->game);
		this->removeJobs();

		if (game && game->getDataModel())
		{
			if (RBX::RunService* runService = game->getDataModel()->find<RBX::RunService>())
				runService->stopTasks();

			if (RBX::ControllerService* service = RBX::ServiceProvider::create<RBX::ControllerService>(game->getDataModel().get()))
				service->setHardwareDevice(NULL);
		}

		unbindWorkspace();
		game->shutdown();

		game.reset();
	}

	void View::ExecuteScript(std::string scriptUrl, int launchMode)
	{
		shared_ptr<RBX::DataModel> dataModel = game->getDataModel();
		Security::Impersonator impersonate(Security::COM);

		std::string data;
		ProtectedString verifiedSource;
		
		try
		{
			// get join data
			RBX::Http(scriptUrl).get(data);
			verifiedSource = ProtectedString::fromTrustedSource(data);
		}
		catch(std::bad_alloc& e)
		{
			throw;
		}
		catch(std::exception& e)
		{
			return;
		}

		if (dataModel->isClosed())
			return;

		size_t firstBraceIndex = data.find('{');
		if (firstBraceIndex != std::string::npos)
		{
			game->configurePlayer(Security::COM, data.substr(firstBraceIndex), launchMode);
		}
		else
		{
			ScriptContext* context = dataModel->create<ScriptContext>();
			context->executeInNewThread(Security::COM, verifiedSource, "Start Game");
		}
	}
}