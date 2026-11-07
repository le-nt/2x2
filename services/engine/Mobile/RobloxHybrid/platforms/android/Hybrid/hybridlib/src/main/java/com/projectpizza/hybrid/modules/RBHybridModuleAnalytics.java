package com.projectpizza.hybrid.modules;

import com.projectpizza.hybrid.RBHybridCommand;
import com.projectpizza.hybrid.RBHybridModule;

/**
 * Created by roblox on 3/6/15.
 */
public class RBHybridModuleAnalytics extends RBHybridModule {
    private static final String MODULE_ID = "Analytics";

    public RBHybridModuleAnalytics() {
        super(MODULE_ID);
    }

    @Override
    public void execute(RBHybridCommand command) {
        command.executeCallback(true, null);
    }
}
