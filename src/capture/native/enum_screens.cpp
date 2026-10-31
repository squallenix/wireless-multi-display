#include <windows.h>
#include <iostream>
#include <vector>
#include <string>

struct ScreenInfo {
    int id;
    std::wstring name;
    bool isPrimary;
    int left;
    int top;
    int right;
    int bottom;
    int width;
    int height;
};

static std::wstring escapeJsonString(const std::wstring& input) {
    std::wstring out;
    for (wchar_t c : input) {
        if (c == L'\\') out += L"\\\\";
        else if (c == L'"') out += L"\\\"";
        else out += c;
    }
    return out;
}

static BOOL CALLBACK MonitorEnumProc(HMONITOR hMonitor, HDC hdcMonitor, LPRECT lprcMonitor, LPARAM dwData) {
    auto* screens = reinterpret_cast<std::vector<ScreenInfo>*>(dwData);
    MONITORINFOEXW mi;
    mi.cbSize = sizeof(MONITORINFOEXW);
    if (GetMonitorInfoW(hMonitor, &mi)) {
        ScreenInfo info;
        info.id = static_cast<int>(screens->size());
        info.name = mi.szDevice;
        info.isPrimary = (mi.dwFlags & MONITORINFOF_PRIMARY) != 0;
        info.left = mi.rcMonitor.left;
        info.top = mi.rcMonitor.top;
        info.right = mi.rcMonitor.right;
        info.bottom = mi.rcMonitor.bottom;
        info.width = mi.rcMonitor.right - mi.rcMonitor.left;
        info.height = mi.rcMonitor.bottom - mi.rcMonitor.top;
        screens->push_back(info);
    }
    return TRUE;
}

int main() {
    std::vector<ScreenInfo> screens;
    EnumDisplayMonitors(nullptr, nullptr, MonitorEnumProc, reinterpret_cast<LPARAM>(&screens));

    std::cout << "[";
    for (size_t i = 0; i < screens.size(); ++i) {
        const auto& s = screens[i];
        std::wcout << L"{"
                   << L"\"id\":" << s.id << L","
                   << L"\"name\":\"" << escapeJsonString(s.name) << L"\","
                   << L"\"isPrimary\":" << (s.isPrimary ? L"true" : L"false") << L","
                   << L"\"left\":" << s.left << L","
                   << L"\"top\":" << s.top << L","
                   << L"\"right\":" << s.right << L","
                   << L"\"bottom\":" << s.bottom << L","
                   << L"\"width\":" << s.width << L","
                   << L"\"height\":" << s.height
                   << L"}";
        if (i + 1 < screens.size()) std::cout << ",";
    }
    std::cout << "]" << std::endl;
    return 0;
}
