#include "GamePerfMonitor.h"

#include "v8datamodel/DataModel.h"
#include "v8datamodel/Workspace.h"
#include "v8datamodel/Stats.h"
#include "v8datamodel/DebugSettings.h"
#include "v8datamodel/TimerService.h"
#include "v8world/World.h"
#include "util/RunStateOwner.h"

#include "network/Players.h"

using namespace RBX;


FASTINTVARIABLE(GamePerfMonitorPercentage,2)
FASTINTVARIABLE(GamePerfMonitorReportTimer, 10) // minutes

GamePerfMonitor::~GamePerfMonitor()
{
}

void GamePerfMonitor::collectAndPostStats(boost::weak_ptr<DataModel> dataModel)
{
	boost::shared_ptr<DataModel> sharedDM = dataModel.lock(); 
	if (!sharedDM)
		return;

	if (sharedDM->isClosed())
		return;

    postDiagStats(sharedDM);

	if (TimerService* timer = sharedDM->create<TimerService>()) {
		timer->delay(boost::bind(&GamePerfMonitor::collectAndPostStats, this, dataModel), FInt::GamePerfMonitorReportTimer*60);
	}	
}

void GamePerfMonitor::postDiagStats(boost::shared_ptr<DataModel> dataModel)
{

}

void GamePerfMonitor::onGameClose(boost::weak_ptr<DataModel> dataModel)
{

}

void GamePerfMonitor::start(DataModel* dataModel)
{
	if (!dataModel)
		return;

	Stats::StatsService* statsService = dataModel->create<Stats::StatsService>();
	if (statsService)
		frmStats = shared_from(statsService->findFirstChildByName("FrameRateManager"));

	bool shouldPost = (abs(userId) % 100) < FInt::GamePerfMonitorPercentage;
	dataModel->setJobsExtendedStatsWindow(30);

	if (shouldPost)
	{
		if (TimerService* timer = dataModel->create<TimerService>()) {
			timer->delay(boost::bind(&GamePerfMonitor::collectAndPostStats, this, weak_from(dataModel)), 60);
		}
	}

	if (shouldPost)
	{
		dataModel->closingSignal.connect(boost::bind(&GamePerfMonitor::onGameClose, this, weak_from(dataModel)));
	}
}



