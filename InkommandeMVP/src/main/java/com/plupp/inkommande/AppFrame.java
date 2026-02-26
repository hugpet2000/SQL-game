package com.plupp.inkommande;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.table.AbstractTableModel;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.TableRowSorter;
import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.Transferable;
import java.awt.Desktop;
import java.io.File;
import java.nio.file.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.concurrent.atomic.AtomicBoolean;

public class AppFrame extends JFrame {
    private static final Color CREAM = Color.decode("#F4F1AE");
    private static final Color ORANGE_LIGHT = Color.decode("#FF8D52");
    private static final Color ORANGE_STRONG = Color.decode("#F85A16");
    private static final Color MAGENTA = Color.decode("#CA005E");
    private static final Color TEXT_DARK = new Color(38, 28, 20);

    private static final Color DARK_BG = new Color(28, 22, 29);
    private static final Color DARK_CARD = new Color(43, 33, 45);
    private static final Color DARK_TEXT = new Color(245, 234, 224);
    private static final Color DARK_BORDER = new Color(101, 64, 93);

    private final AppConfig config = new AppConfig();
    private final Database db = new Database(config.getDatabasePath());

    private Path baseDir;
    private Path incomingDir;

    private final JTextField searchField = new JTextField();
    private final JList<String> suggestionsList = new JList<>();
    private final JPopupMenu suggestionsPopup = new JPopupMenu();
    private final JLabel statusLabel = new JLabel("Ready");
    private final FileTableModel tableModel = new FileTableModel();
    private final JTable table = new JTable(tableModel);

    private final JButton prevPageBtn = new JButton("Prev");
    private final JButton nextPageBtn = new JButton("Next");
    private final JLabel pageLabel = new JLabel("Page 1");
    private int page = 0;
    private static final int PAGE_SIZE = 25;
    private boolean darkMode;
    private Timer searchDebounceTimer;
    private SwingWorker<List<String>, Void> autocompleteWorker;
    private SwingWorker<List<FileRecord>, Void> tableWorker;
    private String lastSearchQuery = "";
    private boolean selectFirstRowOnRefresh = false;
    private WatchService watchService;
    private Thread watchThread;
    private final AtomicBoolean watching = new AtomicBoolean(false);

    public AppFrame() {
        super("INKOMMANDE MVP");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(1200, 700);
        setLocationRelativeTo(null);

        try {
            Files.createDirectories(config.getAppDir());
            db.init();
        } catch (Exception e) {
            showFatal("Failed to initialize app: " + e.getMessage());
            return;
        }

        initStorage();
        darkMode = config.loadDarkMode();
        buildUi();
        requestTableRefresh();
        startIncomingWatcher();

        addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                stopIncomingWatcher();
            }
        });
    }

    private void initStorage() {
        Path saved = config.loadBaseDir();
        if (isValidBaseDir(saved)) {
            setBaseDir(saved);
            return;
        }
        chooseBaseDir(true);
    }

    private boolean isValidBaseDir(Path p) {
        return p != null && Files.exists(p) && Files.isDirectory(p) && Files.isWritable(p);
    }

    private void setBaseDir(Path p) {
        Path previousIncoming = this.incomingDir;
        this.baseDir = p;
        this.incomingDir = p.resolve("INKOMMANDE");
        try {
            Files.createDirectories(incomingDir);
            config.saveBaseDir(p);

            if (previousIncoming != null && !previousIncoming.equals(incomingDir)) {
                db.clearAllFiles();
                tableModel.setRows(List.of());
                statusLabel.setText("Location changed: cleared previous DB rows");
            }

            startIncomingWatcher();
            syncIncomingDirectoryAsync(false);
        } catch (Exception e) {
            showError("Could not set INKOMMANDE directory: " + e.getMessage());
        }
    }

    private void chooseBaseDir(boolean mandatory) {
        while (true) {
            JFileChooser chooser = new JFileChooser();
            chooser.setDialogTitle("Choose base directory for INKOMMANDE");
            chooser.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
            int result = chooser.showOpenDialog(this);
            if (result != JFileChooser.APPROVE_OPTION) {
                if (mandatory) {
                    JOptionPane.showMessageDialog(this, "You must choose a directory to continue.");
                    continue;
                }
                return;
            }
            Path chosen = chooser.getSelectedFile().toPath();
            if (!isValidBaseDir(chosen)) {
                JOptionPane.showMessageDialog(this, "Directory is invalid or not writable.");
                continue;
            }
            setBaseDir(chosen);
            break;
        }
    }

    private Color appBg() {
        if (darkMode) return DARK_BG;
        Color c = UIManager.getColor("Panel.background");
        return c != null ? c : CREAM;
    }

    private Color cardBg() {
        if (darkMode) return DARK_CARD;
        Color c = UIManager.getColor("Panel.background");
        return c != null ? c : Color.WHITE;
    }

    private Color textColor() {
        if (darkMode) return DARK_TEXT;
        Color c = UIManager.getColor("Label.foreground");
        return c != null ? c : TEXT_DARK;
    }

    private Color borderColor() {
        if (darkMode) return DARK_BORDER;
        Color c = UIManager.getColor("Separator.foreground");
        return c != null ? c : new Color(200, 200, 200);
    }

    private Color tableAlt() {
        return darkMode ? darken(DARK_CARD, 0.12f) : new Color(245, 245, 245);
    }

    private Color inputBg() {
        if (darkMode) return new Color(58, 44, 61);
        Color c = UIManager.getColor("TextField.background");
        return c != null ? c : Color.WHITE;
    }

    private void buildUi() {
        getContentPane().removeAll();
        getContentPane().setBackground(appBg());
        setLayout(new BorderLayout(10, 10));

        JPanel root = new JPanel(new BorderLayout(12, 12));
        root.setOpaque(false);
        root.setBorder(new EmptyBorder(12, 12, 12, 12));

        JPanel top = new JPanel(new BorderLayout(10, 10));
        top.setOpaque(false);

        JPanel headerCard = createCardPanel(new BorderLayout(8, 4));
        JLabel title = new JLabel("INKOMMANDE");
        title.setFont(title.getFont().deriveFont(Font.BOLD, 24f));
        title.setForeground(textColor());
        JLabel subtitle = new JLabel("Drop files, enrich metadata, and find everything instantly");
        subtitle.setForeground(textColor());
        subtitle.setFont(subtitle.getFont().deriveFont(Font.PLAIN, 13f));
        headerCard.add(title, BorderLayout.NORTH);
        headerCard.add(subtitle, BorderLayout.CENTER);

        JButton addFileBtn = new JButton("Add file");
        styleButton(addFileBtn, ORANGE_STRONG, Color.WHITE);
        addFileBtn.addActionListener(e -> showAddFileDialog());

        JButton changePathBtn = new JButton("Change location");
        styleButton(changePathBtn, MAGENTA, Color.WHITE);
        changePathBtn.addActionListener(e -> chooseBaseDir(false));

        JButton themeBtn = new JButton(darkMode ? "Light mode" : "Dark mode");
        styleButton(themeBtn, ORANGE_LIGHT, textColor());
        themeBtn.addActionListener(e -> {
            darkMode = !darkMode;
            try { config.saveDarkMode(darkMode); } catch (Exception ignored) {}
            buildUi();
            requestTableRefresh();
            revalidate();
            repaint();
        });

        JPanel rightButtons = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
        rightButtons.setOpaque(false);
        rightButtons.add(addFileBtn);
        rightButtons.add(changePathBtn);
        rightButtons.add(themeBtn);

        JPanel actionsCard = createCardPanel(new BorderLayout());
        actionsCard.add(rightButtons, BorderLayout.CENTER);

        top.add(headerCard, BorderLayout.CENTER);
        top.add(actionsCard, BorderLayout.EAST);

        JPanel searchAndDrop = new JPanel(new BorderLayout(10, 10));
        searchAndDrop.setOpaque(false);

        JPanel searchPanel = createCardPanel(new BorderLayout(8, 8));
        JLabel searchLabel = new JLabel("Search");
        searchLabel.setForeground(textColor());
        searchLabel.setFont(searchLabel.getFont().deriveFont(Font.BOLD, 14f));
        styleTextField(searchField);
        searchPanel.add(searchLabel, BorderLayout.WEST);
        searchPanel.add(searchField, BorderLayout.CENTER);

        JPanel dropHint = createCardPanel(new BorderLayout());
        dropHint.setBackground(cardBg());
        JLabel dropHintLabel = new JLabel("Tip: You can drag files directly onto this window", SwingConstants.CENTER);
        dropHintLabel.setForeground(textColor());
        dropHintLabel.setFont(dropHintLabel.getFont().deriveFont(Font.BOLD, 13f));
        dropHint.add(dropHintLabel, BorderLayout.CENTER);
        dropHint.setCursor(new Cursor(Cursor.HAND_CURSOR));
        dropHint.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                showAddFileDialog();
            }
        });

        searchAndDrop.add(searchPanel, BorderLayout.CENTER);
        searchAndDrop.add(dropHint, BorderLayout.EAST);

        JPanel topWrap = new JPanel(new BorderLayout(10, 10));
        topWrap.setOpaque(false);
        topWrap.add(top, BorderLayout.NORTH);
        topWrap.add(searchAndDrop, BorderLayout.SOUTH);
        root.add(topWrap, BorderLayout.NORTH);

        table.setAutoCreateRowSorter(true);
        table.setFillsViewportHeight(true);
        table.setRowHeight(32);
        table.setSelectionBackground(UIManager.getColor("Table.selectionBackground"));
        table.setSelectionForeground(UIManager.getColor("Table.selectionForeground"));
        table.setGridColor(UIManager.getColor("Table.gridColor"));
        table.setShowVerticalLines(true);
        table.getTableHeader().setBackground(UIManager.getColor("TableHeader.background"));
        table.getTableHeader().setForeground(UIManager.getColor("TableHeader.foreground"));
        table.getTableHeader().setFont(table.getTableHeader().getFont().deriveFont(Font.BOLD, 13f));
        table.setDefaultRenderer(Object.class, new ZebraTableCellRenderer());

        TableRowSorter<FileTableModel> sorter = new TableRowSorter<>(tableModel);
        sorter.setComparator(4, Comparator.comparingLong(v -> Long.parseLong(v.toString())));
        table.setRowSorter(sorter);

        JScrollPane scrollPane = new JScrollPane(table);
        scrollPane.getViewport().setBackground(inputBg());
        scrollPane.setBorder(BorderFactory.createLineBorder(ORANGE_LIGHT, 1));
        scrollPane.setOpaque(false);

        JPanel tableCard = createCardPanel(new BorderLayout());
        tableCard.add(scrollPane, BorderLayout.CENTER);
        root.add(tableCard, BorderLayout.CENTER);

        JPanel bottom = createCardPanel(new BorderLayout(8, 8));

        JPanel pager = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        pager.setOpaque(false);
        styleButton(prevPageBtn, ORANGE_LIGHT, TEXT_DARK);
        styleButton(nextPageBtn, ORANGE_LIGHT, TEXT_DARK);
        prevPageBtn.addActionListener(e -> { if (page > 0) { page--; requestTableRefresh(); } });
        nextPageBtn.addActionListener(e -> { page++; requestTableRefresh(); });
        pageLabel.setForeground(textColor());
        pageLabel.setFont(pageLabel.getFont().deriveFont(Font.BOLD));
        pager.add(prevPageBtn);
        pager.add(nextPageBtn);
        pager.add(pageLabel);

        JButton editBtn = new JButton("Edit selected");
        styleButton(editBtn, ORANGE_LIGHT, TEXT_DARK);
        editBtn.addActionListener(e -> editSelectedRow());

        JButton deleteBtn = new JButton("Delete selected");
        styleButton(deleteBtn, MAGENTA, Color.WHITE);
        deleteBtn.addActionListener(e -> deleteSelectedRow());

        JButton openBtn = new JButton("Open selected file");
        styleButton(openBtn, ORANGE_STRONG, Color.WHITE);
        openBtn.addActionListener(e -> openSelectedFile());

        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        right.setOpaque(false);
        right.add(editBtn);
        right.add(deleteBtn);
        right.add(openBtn);

        statusLabel.setForeground(textColor());
        statusLabel.setOpaque(false);
        statusLabel.setBorder(new EmptyBorder(6, 2, 6, 2));
        statusLabel.setFont(statusLabel.getFont().deriveFont(Font.PLAIN, 12f));

        bottom.add(pager, BorderLayout.WEST);
        bottom.add(statusLabel, BorderLayout.CENTER);
        bottom.add(right, BorderLayout.EAST);
        root.add(bottom, BorderLayout.SOUTH);

        add(root, BorderLayout.CENTER);

        setupDragAndDrop();
        setupSearch();
        setupAutocomplete();
    }

    private JPanel createCardPanel(LayoutManager layout) {
        JPanel panel = new JPanel(layout);
        panel.setBackground(cardBg());
        panel.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(borderColor(), 1, true),
                new EmptyBorder(10, 12, 10, 12)
        ));
        return panel;
    }

    private void styleButton(JButton button, Color bg, Color fg) {
        button.setFocusPainted(false);
        button.setFont(button.getFont().deriveFont(Font.PLAIN, 13f));
        button.setCursor(new Cursor(Cursor.HAND_CURSOR));
        button.setMargin(new Insets(6, 12, 6, 12));
        button.setOpaque(true);
        button.setContentAreaFilled(true);
        button.setBackground(bg);
        button.setForeground(fg);
        button.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(darken(bg, darkMode ? 0.15f : 0.2f), 1, true),
                new EmptyBorder(4, 8, 4, 8)
        ));
    }

    private void styleTextField(JTextField textField) {
        textField.setBackground(inputBg());
        textField.setForeground(textColor());
        textField.setCaretColor(textColor());
        textField.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(borderColor(), 1),
                new EmptyBorder(6, 8, 6, 8)
        ));
    }

    private void setupDragAndDrop() {
        getRootPane().setTransferHandler(new TransferHandler() {
            @Override
            public boolean canImport(TransferSupport support) {
                return support.isDataFlavorSupported(DataFlavor.javaFileListFlavor);
            }

            @Override
            public boolean importData(TransferSupport support) {
                if (!canImport(support)) return false;
                try {
                    Transferable t = support.getTransferable();
                    @SuppressWarnings("unchecked")
                    List<File> files = (List<File>) t.getTransferData(DataFlavor.javaFileListFlavor);
                    return handleIncomingFiles(files.stream().map(File::toPath).toList());
                } catch (Exception e) {
                    showError("Drop failed: " + e.getMessage());
                    return false;
                }
            }
        });
    }

    private boolean handleIncomingFiles(List<Path> paths) {
        List<Path> onlyFiles = paths.stream().filter(Files::isRegularFile).toList();
        if (onlyFiles.isEmpty()) {
            showError("Only files are supported in MVP (not folders).");
            return false;
        }
        importFilesAsync(onlyFiles);
        return true;
    }

    private void showAddFileDialog() {
        JDialog dialog = new JDialog(this, "Add file", true);
        dialog.setSize(520, 280);
        dialog.setLocationRelativeTo(this);
        dialog.setLayout(new BorderLayout(8, 8));

        JPanel root = new JPanel(new BorderLayout(8, 8));
        root.setBackground(appBg());
        root.setBorder(new EmptyBorder(12, 12, 12, 12));

        JLabel help = new JLabel("Drag & drop files here, or click Browse", SwingConstants.CENTER);
        help.setFont(help.getFont().deriveFont(Font.BOLD, 16f));
        help.setForeground(textColor());

        JPanel dropPanel = new JPanel(new BorderLayout());
        dropPanel.setBackground(darkMode ? new Color(58, 44, 61) : new Color(255, 252, 225));
        dropPanel.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(ORANGE_LIGHT, 2, true),
                new EmptyBorder(20, 20, 20, 20)
        ));
        dropPanel.add(help, BorderLayout.CENTER);

        JButton browseBtn = new JButton("Browse files...");
        styleButton(browseBtn, ORANGE_STRONG, Color.WHITE);
        browseBtn.addActionListener(e -> {
            JFileChooser chooser = new JFileChooser();
            chooser.setDialogTitle("Select files");
            chooser.setMultiSelectionEnabled(true);
            chooser.setFileSelectionMode(JFileChooser.FILES_ONLY);
            int result = chooser.showOpenDialog(dialog);
            if (result == JFileChooser.APPROVE_OPTION) {
                File[] selected = chooser.getSelectedFiles();
                if (selected != null && selected.length > 0) {
                    boolean ok = handleIncomingFiles(java.util.Arrays.stream(selected).map(File::toPath).toList());
                    if (ok) dialog.dispose();
                }
            }
        });

        dropPanel.setTransferHandler(new TransferHandler() {
            @Override
            public boolean canImport(TransferSupport support) {
                return support.isDataFlavorSupported(DataFlavor.javaFileListFlavor);
            }

            @Override
            public boolean importData(TransferSupport support) {
                if (!canImport(support)) return false;
                try {
                    @SuppressWarnings("unchecked")
                    List<File> files = (List<File>) support.getTransferable().getTransferData(DataFlavor.javaFileListFlavor);
                    boolean ok = handleIncomingFiles(files.stream().map(File::toPath).toList());
                    if (ok) dialog.dispose();
                    return ok;
                } catch (Exception e) {
                    showError("Drop failed: " + e.getMessage());
                    return false;
                }
            }
        });

        JPanel bottom = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        bottom.setOpaque(false);
        bottom.add(browseBtn);

        root.add(dropPanel, BorderLayout.CENTER);
        root.add(bottom, BorderLayout.SOUTH);
        dialog.setContentPane(root);
        dialog.setVisible(true);
    }

    private void importFilesAsync(List<Path> files) {
        if (incomingDir == null || !Files.isDirectory(incomingDir) || !Files.isWritable(incomingDir)) {
            showError("INKOMMANDE path is invalid. Please choose a new location.");
            chooseBaseDir(true);
            return;
        }

        statusLabel.setText("Importing " + files.size() + " file(s)...");
        new SwingWorker<ImportResult, Void>() {
            @Override
            protected ImportResult doInBackground() {
                List<FileRecord> imported = new ArrayList<>();
                List<String> failures = new ArrayList<>();

                for (Path src : files) {
                    Path dest = null;
                    try {
                        String storedName = uniqueName(src.getFileName().toString());
                        dest = incomingDir.resolve(storedName);
                        try {
                            Files.copy(src, dest, StandardCopyOption.COPY_ATTRIBUTES);
                        } catch (Exception copyWithAttrsError) {
                            Files.copy(src, dest);
                        }

                        long id = db.insertImportedFile(
                                src.getFileName().toString(),
                                storedName,
                                dest.toAbsolutePath().toString(),
                                Files.size(dest),
                                LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                        );

                        FileRecord rec = new FileRecord();
                        rec.id = id;
                        rec.originalFilename = src.getFileName().toString();
                        rec.storedFilename = storedName;
                        imported.add(rec);
                    } catch (Exception e) {
                        if (dest != null) {
                            try {
                                Files.deleteIfExists(dest);
                            } catch (Exception cleanupError) {
                                failures.add(src.getFileName() + ": " + e.getMessage() + " (cleanup failed: " + cleanupError.getMessage() + ")");
                                continue;
                            }
                        }
                        failures.add(src.getFileName() + ": " + e.getMessage());
                    }
                }

                return new ImportResult(imported, failures);
            }

            @Override
            protected void done() {
                try {
                    ImportResult result = get();
                    for (FileRecord r : result.imported()) {
                        showMetadataDialog(r);
                    }
                    requestTableRefresh();

                    if (result.failures().isEmpty()) {
                        statusLabel.setText("Imported " + result.imported().size() + " file(s)");
                    } else {
                        statusLabel.setText("Imported " + result.imported().size() + " file(s), failed " + result.failures().size());
                        showError("Some files failed to import:\n- " + String.join("\n- ", result.failures()));
                    }
                } catch (InterruptedException | ExecutionException e) {
                    Throwable cause = e.getCause() != null ? e.getCause() : e;
                    showError("Import failed: " + cause.getMessage());
                    statusLabel.setText("Import failed");
                }
            }
        }.execute();
    }

    private String uniqueName(String original) {
        Path p = Path.of(original);
        String fileName = p.getFileName().toString();
        int dot = fileName.lastIndexOf('.');
        String base = dot > 0 ? fileName.substring(0, dot) : fileName;
        String ext = dot > 0 ? fileName.substring(dot) : "";

        String candidate = fileName;
        int n = 1;
        while (Files.exists(incomingDir.resolve(candidate))) {
            candidate = base + " (" + n++ + ")" + ext;
        }
        return candidate;
    }

    private void showMetadataDialog(FileRecord rec) {
        JTextField title = new JTextField(stripExtension(rec.originalFilename));
        JTextField category = new JTextField();
        JTextField tags = new JTextField();
        JTextField date = new JTextField();
        JTextField source = new JTextField();
        JTextArea description = new JTextArea(5, 34);
        description.setLineWrap(true);
        description.setWrapStyleWord(true);

        styleTextField(title);
        styleTextField(category);
        styleTextField(tags);
        styleTextField(date);
        styleTextField(source);
        description.setBackground(inputBg());
        description.setForeground(textColor());
        description.setCaretColor(textColor());
        description.setBorder(new EmptyBorder(6, 8, 6, 8));

        JLabel hint = new JLabel("Title is required. Date format: YYYY-MM-DD. Tags separated with commas.");
        Color disabled = UIManager.getColor("Label.disabledForeground");
        hint.setForeground(disabled != null ? disabled : darken(textColor(), 0.3f));

        JPanel panel = new JPanel(new GridBagLayout());
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(5, 5, 5, 5);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.weightx = 0;

        c.gridx = 0; c.gridy = 0; panel.add(new JLabel("Title *"), c);
        c.gridx = 1; c.weightx = 1; panel.add(title, c);
        c.gridx = 0; c.gridy++; c.weightx = 0; panel.add(new JLabel("Description"), c);
        c.gridx = 1; c.weightx = 1;
        JScrollPane descScroll = new JScrollPane(description);
        descScroll.setPreferredSize(new Dimension(420, 100));
        descScroll.getViewport().setBackground(inputBg());
        descScroll.setBorder(BorderFactory.createLineBorder(borderColor(), 1));
        panel.add(descScroll, c);
        c.gridx = 0; c.gridy++; c.weightx = 0; panel.add(new JLabel("Category"), c);
        c.gridx = 1; c.weightx = 1; panel.add(category, c);
        c.gridx = 0; c.gridy++; c.weightx = 0; panel.add(new JLabel("Tags"), c);
        c.gridx = 1; c.weightx = 1; panel.add(tags, c);
        c.gridx = 0; c.gridy++; c.weightx = 0; panel.add(new JLabel("Document date"), c);
        c.gridx = 1; c.weightx = 1; panel.add(date, c);
        c.gridx = 0; c.gridy++; c.weightx = 0; panel.add(new JLabel("Source"), c);
        c.gridx = 1; c.weightx = 1; panel.add(source, c);
        c.gridx = 1; c.gridy++; panel.add(hint, c);

        while (true) {
            int result = JOptionPane.showConfirmDialog(this, panel,
                    "Metadata for: " + rec.originalFilename,
                    JOptionPane.OK_CANCEL_OPTION,
                    JOptionPane.PLAIN_MESSAGE);
            if (result != JOptionPane.OK_OPTION) break;

            String titleValue = title.getText().trim();
            String dateValue = date.getText().trim();
            if (titleValue.isBlank()) {
                showError("Title is required.");
                continue;
            }
            if (!dateValue.isBlank()) {
                try {
                    LocalDate.parse(dateValue);
                } catch (DateTimeParseException ex) {
                    showError("Document date must be YYYY-MM-DD.");
                    continue;
                }
            }

            try {
                db.saveMetadata(
                        rec.id,
                        titleValue,
                        description.getText().trim(),
                        category.getText().trim(),
                        tags.getText().trim(),
                        dateValue,
                        source.getText().trim()
                );
                break;
            } catch (Exception e) {
                showError("Failed to save metadata: " + e.getMessage());
            }
        }
    }

    private String stripExtension(String fn) {
        int dot = fn.lastIndexOf('.');
        return dot > 0 ? fn.substring(0, dot) : fn;
    }

    private void startIncomingWatcher() {
        stopIncomingWatcher();
        if (incomingDir == null || !Files.isDirectory(incomingDir)) return;

        try {
            watchService = FileSystems.getDefault().newWatchService();
            incomingDir.register(watchService, StandardWatchEventKinds.ENTRY_CREATE);
            watching.set(true);
            watchThread = new Thread(() -> {
                while (watching.get()) {
                    WatchKey key;
                    try {
                        key = watchService.take();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    } catch (ClosedWatchServiceException e) {
                        break;
                    }

                    boolean hasCreate = false;
                    for (WatchEvent<?> event : key.pollEvents()) {
                        if (event.kind() == StandardWatchEventKinds.OVERFLOW) continue;
                        if (event.kind() == StandardWatchEventKinds.ENTRY_CREATE) {
                            hasCreate = true;
                        }
                    }
                    key.reset();

                    if (hasCreate) {
                        syncIncomingDirectoryAsync(true);
                    }
                }
            }, "inkommande-dir-watch");
            watchThread.setDaemon(true);
            watchThread.start();
        } catch (Exception e) {
            statusLabel.setText("Watcher unavailable: " + e.getMessage());
        }
    }

    private void stopIncomingWatcher() {
        watching.set(false);
        if (watchService != null) {
            try {
                watchService.close();
            } catch (Exception ignored) {}
            watchService = null;
        }
        if (watchThread != null) {
            watchThread.interrupt();
            watchThread = null;
        }
    }

    private void syncIncomingDirectoryAsync(boolean notifyOnChange) {
        if (incomingDir == null || !Files.isDirectory(incomingDir)) return;

        new SwingWorker<List<FileRecord>, Void>() {
            @Override
            protected List<FileRecord> doInBackground() throws Exception {
                List<Path> files;
                try (java.util.stream.Stream<Path> stream = Files.list(incomingDir)) {
                    files = stream.filter(Files::isRegularFile).toList();
                }
                return db.listMissingFromPaths(files);
            }

            @Override
            protected void done() {
                try {
                    List<FileRecord> inserted = get();
                    if (!inserted.isEmpty()) {
                        requestTableRefresh();
                        if (notifyOnChange) {
                            statusLabel.setText("Detected " + inserted.size() + " new file(s) in INKOMMANDE");
                        }
                    }
                } catch (Exception ignored) {
                    // Best effort sync.
                }
            }
        }.execute();
    }

    private void setupSearch() {
        searchDebounceTimer = new Timer(180, e -> {
            page = 0;
            requestTableRefresh();
        });
        searchDebounceTimer.setRepeats(false);

        searchField.addActionListener(e -> {
            if (searchDebounceTimer.isRunning()) searchDebounceTimer.stop();
            page = 0;
            selectFirstRowOnRefresh = true;
            requestTableRefresh();
            suggestionsPopup.setVisible(false);
        });

        searchField.getDocument().addDocumentListener((SimpleDocumentListener) e -> {
            refreshAutocomplete();
            searchDebounceTimer.restart();
        });

        searchField.addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.VK_ESCAPE) {
                    suggestionsPopup.setVisible(false);
                    return;
                }

                if (!suggestionsPopup.isVisible()) return;

                if (e.getKeyCode() == KeyEvent.VK_DOWN) {
                    int size = suggestionsList.getModel().getSize();
                    if (size == 0) return;
                    int idx = suggestionsList.getSelectedIndex();
                    idx = Math.min(size - 1, idx + 1);
                    suggestionsList.setSelectedIndex(idx);
                    suggestionsList.ensureIndexIsVisible(idx);
                    e.consume();
                } else if (e.getKeyCode() == KeyEvent.VK_UP) {
                    int size = suggestionsList.getModel().getSize();
                    if (size == 0) return;
                    int idx = suggestionsList.getSelectedIndex();
                    if (idx < 0) idx = 0;
                    idx = Math.max(0, idx - 1);
                    suggestionsList.setSelectedIndex(idx);
                    suggestionsList.ensureIndexIsVisible(idx);
                    e.consume();
                } else if (e.getKeyCode() == KeyEvent.VK_ENTER) {
                    String selected = suggestionsList.getSelectedValue();
                    if (selected != null && !selected.isBlank()) {
                        searchField.setText(selected);
                        suggestionsPopup.setVisible(false);
                        if (searchDebounceTimer.isRunning()) searchDebounceTimer.stop();
                        page = 0;
                        selectFirstRowOnRefresh = true;
                        requestTableRefresh();
                        e.consume();
                    }
                }
            }
        });

        searchField.addFocusListener(new FocusAdapter() {
            @Override
            public void focusLost(FocusEvent e) {
                SwingUtilities.invokeLater(() -> {
                    if (!searchField.isFocusOwner()) {
                        suggestionsPopup.setVisible(false);
                    }
                });
            }
        });
    }

    private void setupAutocomplete() {
        suggestionsList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        suggestionsList.setBackground(inputBg());
        suggestionsList.setForeground(textColor());
        suggestionsList.setSelectionBackground(ORANGE_LIGHT);
        suggestionsList.setSelectionForeground(textColor());
        suggestionsList.setBorder(new EmptyBorder(4, 4, 4, 4));
        suggestionsList.setFocusable(false);
        suggestionsList.setRequestFocusEnabled(false);
        suggestionsList.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (e.getClickCount() >= 1) {
                    String selected = suggestionsList.getSelectedValue();
                    if (selected != null && !selected.isBlank()) {
                        searchField.setText(selected);
                        suggestionsPopup.setVisible(false);
                        if (searchDebounceTimer != null && searchDebounceTimer.isRunning()) searchDebounceTimer.stop();
                        page = 0;
                        requestTableRefresh();
                    }
                }
            }
        });
        suggestionsPopup.setBorder(BorderFactory.createLineBorder(ORANGE_LIGHT));
        suggestionsPopup.setFocusable(false);
        JScrollPane suggestionsScroll = new JScrollPane(suggestionsList);
        suggestionsScroll.setFocusable(false);
        suggestionsScroll.setRequestFocusEnabled(false);
        suggestionsPopup.add(suggestionsScroll);
    }

    private void refreshAutocomplete() {
        if (!searchField.isFocusOwner()) return;

        String prefix = searchField.getText().trim();
        if (prefix.length() < 2) {
            suggestionsPopup.setVisible(false);
            if (autocompleteWorker != null && !autocompleteWorker.isDone()) autocompleteWorker.cancel(true);
            return;
        }

        if (autocompleteWorker != null && !autocompleteWorker.isDone()) {
            autocompleteWorker.cancel(true);
        }

        final String query = prefix;
        autocompleteWorker = new SwingWorker<>() {
            @Override
            protected List<String> doInBackground() throws Exception {
                return db.autocomplete(query, 10);
            }

            @Override
            protected void done() {
                if (isCancelled()) return;
                if (!searchField.isFocusOwner()) return;
                if (!query.equals(searchField.getText().trim())) return;
                try {
                    List<String> suggestions = get();
                    if (suggestions.isEmpty()) {
                        suggestionsPopup.setVisible(false);
                        return;
                    }
                    suggestionsList.setListData(suggestions.toArray(new String[0]));
                    if (suggestionsList.getModel().getSize() > 0) {
                        suggestionsList.setSelectedIndex(0);
                    }
                    suggestionsPopup.setPopupSize(searchField.getWidth(), 150);
                    suggestionsPopup.show(searchField, 0, searchField.getHeight());
                } catch (Exception e) {
                    suggestionsPopup.setVisible(false);
                }
            }
        };
        autocompleteWorker.execute();
    }

    private void requestTableRefresh() {
        final String query = searchField.getText() == null ? "" : searchField.getText().trim();
        if (query.equals(lastSearchQuery) && tableWorker != null && !tableWorker.isDone()) {
            return;
        }
        lastSearchQuery = query;

        if (tableWorker != null && !tableWorker.isDone()) {
            tableWorker.cancel(true);
        }

        statusLabel.setText(query.isBlank() ? "Loading files..." : "Searching...");
        final int requestedPage = page;
        tableWorker = new SwingWorker<>() {
            @Override
            protected List<FileRecord> doInBackground() throws Exception {
                return db.listFiles(query);
            }

            @Override
            protected void done() {
                if (isCancelled()) return;
                try {
                    List<FileRecord> all = get();
                    int currentPage = requestedPage;
                    int start = currentPage * PAGE_SIZE;
                    if (start >= all.size() && currentPage > 0) {
                        currentPage--;
                        start = currentPage * PAGE_SIZE;
                    }
                    int end = Math.min(start + PAGE_SIZE, all.size());
                    List<FileRecord> slice = start < all.size() ? all.subList(start, end) : List.of();
                    page = currentPage;
                    tableModel.setRows(slice);

                    int totalPages = Math.max(1, (int) Math.ceil(all.size() / (double) PAGE_SIZE));
                    pageLabel.setText("Page " + (page + 1) + " / " + totalPages + " (" + all.size() + " rows)");
                    prevPageBtn.setEnabled(page > 0);
                    nextPageBtn.setEnabled((page + 1) < totalPages);
                    statusLabel.setText(all.size() + " result(s)");

                    if (selectFirstRowOnRefresh && tableModel.getRowCount() > 0) {
                        table.setRowSelectionInterval(0, 0);
                        Rectangle rect = table.getCellRect(0, 0, true);
                        table.scrollRectToVisible(rect);
                    }
                    selectFirstRowOnRefresh = false;
                } catch (CancellationException e) {
                    // Ignore cancellation from rapid search/page updates.
                } catch (Exception e) {
                    statusLabel.setText("Load failed");
                    showError("Failed loading dashboard: " + e.getMessage());
                } finally {
                    selectFirstRowOnRefresh = false;
                }
            }
        };
        tableWorker.execute();
    }

    private void openSelectedFile() {
        FileRecord r = getSelectedRowRecord();
        if (r == null) return;
        try {
            Desktop.getDesktop().open(Path.of(r.storedPath).toFile());
        } catch (Exception e) {
            showError("Failed to open file: " + e.getMessage());
        }
    }

    private void editSelectedRow() {
        FileRecord r = getSelectedRowRecord();
        if (r == null) return;

        JTextField title = new JTextField(r.title == null || r.title.isBlank() ? stripExtension(r.storedFilename) : r.title);
        JTextField category = new JTextField(r.category == null ? "" : r.category);
        JTextField tags = new JTextField(r.tags == null ? "" : r.tags);
        JTextField date = new JTextField(r.documentDate == null ? "" : r.documentDate);
        JTextField source = new JTextField(r.source == null ? "" : r.source);
        JTextArea description = new JTextArea(r.description == null ? "" : r.description, 5, 34);
        description.setLineWrap(true);
        description.setWrapStyleWord(true);

        styleTextField(title);
        styleTextField(category);
        styleTextField(tags);
        styleTextField(date);
        styleTextField(source);
        description.setBackground(inputBg());
        description.setForeground(textColor());
        description.setCaretColor(textColor());
        description.setBorder(new EmptyBorder(6, 8, 6, 8));

        JPanel panel = new JPanel(new GridBagLayout());
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(5, 5, 5, 5);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.weightx = 0;
        c.gridx = 0; c.gridy = 0; panel.add(new JLabel("Title *"), c);
        c.gridx = 1; c.weightx = 1; panel.add(title, c);
        c.gridx = 0; c.gridy++; c.weightx = 0; panel.add(new JLabel("Description"), c);
        c.gridx = 1; c.weightx = 1;
        JScrollPane descScroll = new JScrollPane(description);
        descScroll.setPreferredSize(new Dimension(420, 100));
        descScroll.getViewport().setBackground(inputBg());
        descScroll.setBorder(BorderFactory.createLineBorder(borderColor(), 1));
        panel.add(descScroll, c);
        c.gridx = 0; c.gridy++; c.weightx = 0; panel.add(new JLabel("Category"), c);
        c.gridx = 1; c.weightx = 1; panel.add(category, c);
        c.gridx = 0; c.gridy++; c.weightx = 0; panel.add(new JLabel("Tags"), c);
        c.gridx = 1; c.weightx = 1; panel.add(tags, c);
        c.gridx = 0; c.gridy++; c.weightx = 0; panel.add(new JLabel("Document date"), c);
        c.gridx = 1; c.weightx = 1; panel.add(date, c);
        c.gridx = 0; c.gridy++; c.weightx = 0; panel.add(new JLabel("Source"), c);
        c.gridx = 1; c.weightx = 1; panel.add(source, c);

        while (true) {
            int result = JOptionPane.showConfirmDialog(this, panel,
                    "Edit row: " + r.storedFilename,
                    JOptionPane.OK_CANCEL_OPTION,
                    JOptionPane.PLAIN_MESSAGE);
            if (result != JOptionPane.OK_OPTION) break;

            String titleValue = title.getText().trim();
            String dateValue = date.getText().trim();
            if (titleValue.isBlank()) {
                showError("Title is required.");
                continue;
            }
            if (!dateValue.isBlank()) {
                try { LocalDate.parse(dateValue); }
                catch (DateTimeParseException ex) {
                    showError("Document date must be YYYY-MM-DD.");
                    continue;
                }
            }

            try {
                db.updateFileMetadata(
                        r.id,
                        titleValue,
                        description.getText().trim(),
                        category.getText().trim(),
                        tags.getText().trim(),
                        dateValue,
                        source.getText().trim()
                );
                requestTableRefresh();
                statusLabel.setText("Updated row " + r.id);
                break;
            } catch (Exception ex) {
                showError("Failed to update row: " + ex.getMessage());
            }
        }
    }

    private void deleteSelectedRow() {
        FileRecord r = getSelectedRowRecord();
        if (r == null) return;

        JPanel confirmPanel = new JPanel(new BorderLayout(8, 8));
        JLabel question = new JLabel("Delete selected row from DB? " + r.storedFilename);
        JCheckBox deletePhysical = new JCheckBox("Also delete physical file from disk");
        deletePhysical.setOpaque(false);
        confirmPanel.add(question, BorderLayout.NORTH);
        confirmPanel.add(deletePhysical, BorderLayout.CENTER);

        int confirm = JOptionPane.showConfirmDialog(
                this,
                confirmPanel,
                "Confirm delete",
                JOptionPane.YES_NO_OPTION,
                JOptionPane.WARNING_MESSAGE
        );
        if (confirm != JOptionPane.YES_OPTION) return;

        try {
            if (deletePhysical.isSelected() && r.storedPath != null && !r.storedPath.isBlank()) {
                try {
                    Files.deleteIfExists(Path.of(r.storedPath));
                } catch (Exception fileDeleteError) {
                    showError("Could not delete file from disk: " + fileDeleteError.getMessage() + "\nDB row was not deleted.");
                    return;
                }
            }

            db.deleteFileById(r.id);
            requestTableRefresh();
            statusLabel.setText(deletePhysical.isSelected() ? "Deleted row + file " + r.id : "Deleted row " + r.id);
        } catch (Exception e) {
            showError("Failed to delete row: " + e.getMessage());
        }
    }

    private FileRecord getSelectedRowRecord() {
        int viewRow = table.getSelectedRow();
        if (viewRow < 0) {
            showError("Select a row first.");
            return null;
        }
        int modelRow = table.convertRowIndexToModel(viewRow);
        return tableModel.getRow(modelRow);
    }

    private Color darken(Color color, float factor) {
        factor = Math.max(0f, Math.min(1f, factor));
        int r = Math.max(0, (int) (color.getRed() * (1f - factor)));
        int g = Math.max(0, (int) (color.getGreen() * (1f - factor)));
        int b = Math.max(0, (int) (color.getBlue() * (1f - factor)));
        return new Color(r, g, b);
    }

    private void showError(String msg) {
        JOptionPane.showMessageDialog(this, msg, "Error", JOptionPane.ERROR_MESSAGE);
    }

    private void showFatal(String msg) {
        JOptionPane.showMessageDialog(this, msg, "Fatal Error", JOptionPane.ERROR_MESSAGE);
        dispose();
    }

    private record ImportResult(List<FileRecord> imported, List<String> failures) {}

    private class ZebraTableCellRenderer extends DefaultTableCellRenderer {
        @Override
        public Component getTableCellRendererComponent(JTable table, Object value, boolean isSelected, boolean hasFocus, int row, int column) {
            Component c = super.getTableCellRendererComponent(table, value, isSelected, hasFocus, row, column);
            if (isSelected) {
                c.setBackground(table.getSelectionBackground());
                c.setForeground(table.getSelectionForeground());
            } else {
                c.setBackground((row % 2 == 0) ? inputBg() : tableAlt());
                c.setForeground(textColor());
            }
            if (c instanceof JComponent jc) {
                jc.setBorder(new EmptyBorder(2, 6, 2, 6));
            }
            return c;
        }
    }

    private static class FileTableModel extends AbstractTableModel {
        private final String[] cols = {"Title", "Filename", "Category", "Tags", "Size", "Doc Date", "Imported", "Status"};
        private List<FileRecord> rows = new ArrayList<>();

        public void setRows(List<FileRecord> rows) {
            this.rows = new ArrayList<>(rows);
            fireTableDataChanged();
        }

        public FileRecord getRow(int i) {
            return rows.get(i);
        }

        @Override public int getRowCount() { return rows.size(); }
        @Override public int getColumnCount() { return cols.length; }
        @Override public String getColumnName(int c) { return cols[c]; }

        @Override
        public Object getValueAt(int rowIndex, int columnIndex) {
            FileRecord r = rows.get(rowIndex);
            return switch (columnIndex) {
                case 0 -> emptySafe(r.title);
                case 1 -> r.storedFilename;
                case 2 -> emptySafe(r.category);
                case 3 -> emptySafe(r.tags);
                case 4 -> Long.toString(r.fileSize);
                case 5 -> emptySafe(r.documentDate);
                case 6 -> r.importTimestamp;
                case 7 -> r.status;
                default -> "";
            };
        }

        private String emptySafe(String s) { return s == null ? "" : s; }
    }
}
