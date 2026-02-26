package com.plupp.inkommande;

import javax.swing.*;

public class Main {
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            try {
                UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
            } catch (Exception ignored) {}
            AppFrame frame = new AppFrame();
            frame.setVisible(true);
        });
    }
}
