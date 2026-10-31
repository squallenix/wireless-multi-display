#include <windows.h>
#include <iostream>
#include <string>
#include <sstream>

// Basic lightweight JSON parser for input commands
static bool parseKeyValue(const std::string& line, const std::string& key, std::string& outVal) {
    std::string needle = "\"" + key + "\":";
    size_t pos = line.find(needle);
    if (pos == std::string::npos) return false;
    pos += needle.length();
    while (pos < line.length() && (line[pos] == ' ' || line[pos] == '\t')) pos++;
    if (pos >= line.length()) return false;

    if (line[pos] == '"') {
        pos++;
        size_t end = line.find('"', pos);
        if (end == std::string::npos) return false;
        outVal = line.substr(pos, end - pos);
        return true;
    } else {
        size_t end = line.find_first_of(",} \t\r\n", pos);
        if (end == std::string::npos) end = line.length();
        outVal = line.substr(pos, end - pos);
        return true;
    }
}

static bool parseKeyInt(const std::string& line, const std::string& key, int& outVal) {
    std::string s;
    if (parseKeyValue(line, key, s)) {
        try {
            outVal = std::stoi(s);
            return true;
        } catch (...) {
            return false;
        }
    }
    return false;
}

int main() {
    // Attempt switching to Default desktop in case of session mismatch
    HDESK hDesk = OpenDesktopA("Default", 0, FALSE, GENERIC_ALL);
    if (hDesk) {
        SetThreadDesktop(hDesk);
    }

    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;

        std::string action;
        if (!parseKeyValue(line, "action", action)) continue;

        if (action == "move") {
            int x = 0, y = 0;
            if (parseKeyInt(line, "x", x) && parseKeyInt(line, "y", y)) {
                SetCursorPos(x, y);
            }
        } else if (action == "down") {
            int button = 0;
            parseKeyInt(line, "button", button);
            INPUT input = {0};
            input.type = INPUT_MOUSE;
            if (button == 0) input.mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
            else if (button == 2) input.mi.dwFlags = MOUSEEVENTF_RIGHTDOWN;
            else if (button == 1) input.mi.dwFlags = MOUSEEVENTF_MIDDLEDOWN;
            SendInput(1, &input, sizeof(INPUT));
        } else if (action == "up") {
            int button = 0;
            parseKeyInt(line, "button", button);
            INPUT input = {0};
            input.type = INPUT_MOUSE;
            if (button == 0) input.mi.dwFlags = MOUSEEVENTF_LEFTUP;
            else if (button == 2) input.mi.dwFlags = MOUSEEVENTF_RIGHTUP;
            else if (button == 1) input.mi.dwFlags = MOUSEEVENTF_MIDDLEUP;
            SendInput(1, &input, sizeof(INPUT));
        } else if (action == "scroll") {
            int deltaY = 0;
            if (parseKeyInt(line, "deltaY", deltaY)) {
                INPUT input = {0};
                input.type = INPUT_MOUSE;
                input.mi.dwFlags = MOUSEEVENTF_WHEEL;
                input.mi.mouseData = static_cast<DWORD>(deltaY);
                SendInput(1, &input, sizeof(INPUT));
            }
        } else if (action == "ping") {
            std::cout << "pong" << std::endl;
        }
    }

    if (hDesk) CloseDesktop(hDesk);
    return 0;
}
