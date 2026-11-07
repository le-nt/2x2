#pragma once

#include <QWindow>
#include <QOpenGLWindow>
#include <QOpenGLContext>
#include <QString>
#include "UpdateUIManager.h"
#include "RobloxCustomWidgets.h"

#include "util/KeyCode.h"
#include "RobloxView.h"

class RobloxView;

class QOgreWidget : public QOpenGLWindow
{
    Q_OBJECT

public:
    QOgreWidget(const QString& name);
    ~QOgreWidget();

    void setRobloxView(RobloxView* rbxView);

    void activate();
    void deActivate();

    bool hasApplicationFocus() { return m_hasApplicationFocus; }

    bool luaTextBoxHasFocus() const { return m_luaTextBoxHasFocus; }
    void setLuaTextBoxHasFocus(bool hasFocus) { m_luaTextBoxHasFocus = hasFocus; }

protected:
    bool event(QEvent* evt);

    void exposeEvent(QExposeEvent* evt);
    void resizeEvent(QResizeEvent* evt);

    void mousePressEvent(QMouseEvent* evt);
    void mouseReleaseEvent(QMouseEvent* evt);
    void mouseMoveEvent(QMouseEvent* evt);

    void keyPressEvent(QKeyEvent* evt);
    void keyReleaseEvent(QKeyEvent* evt);
    void closeEvent(QCloseEvent* evt);

    bool focusNextPrevChild(bool next);
	void leaveEvent(QEvent *);
	void enterEvent(QEvent *);
	void dragMoveEvent(QDragMoveEvent *evt);

    void wheelEvent(QWheelEvent* evt);
	bool eventFilter(QObject * watched, QEvent * evt);
    void initializeGL();
    void paintGL();

private Q_SLOTS:
    void onFrameSwapped();

private:
    void handleKeyEvent(QKeyEvent* evt,
                        RBX::InputObject::UserInputType eventType,
                        RBX::InputObject::UserInputState eventState,
                        bool processed = false);
                        
    RobloxView* m_pRobloxView;
    int m_bIgnoreEnterEvent;
    bool m_bIgnoreLeaveEvent;
    bool m_bUpdateInProgress;
    bool m_bMouseCommandInvoked;
    bool m_hasApplicationFocus;
    bool m_bRobloxViewInitialized;
    bool m_luaTextBoxHasFocus;

    QPoint lastMovePoint;
    RBX::ModCode lastMoveModCode;

    QString m_name;
};

