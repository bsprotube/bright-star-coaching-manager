import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, TYPOGRAPHY, SPACING } from '../../styles/theme';
import { AuthContext } from '../../context/AuthContext';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api from '../../services/api';
import useWebScroll from '../../hooks/useWebScroll';

// One screen, three audiences: an admin manages the folder tree and uploads
// PDFs, a teacher and a student both just browse and download. Route params
// carry batchId/batchName when opened from the admin's batch list; a student
// opens it with neither (there's exactly one batch they could mean), so on
// that path the screen looks up their own batchId from their profile first.
const StudyMaterialsScreen = ({ route, navigation }) => {
  const { screenStyle, scrollStyle, webRefreshControl } = useWebScroll();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  const [batchId, setBatchId] = useState(route.params?.batchId || null);
  const [batchName, setBatchName] = useState(route.params?.batchName || 'Study Notes');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);

  // The path from the batch root down to wherever we're currently browsing —
  // an in-screen breadcrumb rather than pushing a new navigator screen per
  // folder, since "go up one level" and "jump to any ancestor" are both just
  // slicing this array.
  const [folderStack, setFolderStack] = useState([]);
  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null;

  const [newFolderModalVisible, setNewFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderError, setNewFolderError] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [uploading, setUploading] = useState(false);

  const showMessage = (title, msg) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  // Only hit when opened without route params — i.e. a student's own "Study
  // Notes" entry point — since they belong to exactly one batch and it isn't
  // theirs to choose.
  const resolveOwnBatch = async () => {
    const res = await api.get(`/students/${user.id}`);
    if (res.data.success) {
      const profile = res.data.data.profile;
      setBatchId(profile.batchId);
      setBatchName(profile.batchName || 'Study Notes');
      return profile.batchId;
    }
    return null;
  };

  const fetchContents = async (targetBatchId) => {
    try {
      const params = { batchId: targetBatchId };
      if (currentFolderId) params.parentFolderId = currentFolderId;
      const res = await api.get('/study-materials', { params });
      if (res.data.success) {
        setFolders(res.data.data.folders);
        setFiles(res.data.data.files);
      }
    } catch (error) {
      console.error('Error fetching study materials', error);
      showMessage('Error', error.response?.data?.message || 'Could not load study notes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAll = async () => {
    let bid = batchId;
    if (!bid) {
      bid = await resolveOwnBatch();
      if (!bid) {
        setLoading(false);
        return;
      }
    }
    await fetchContents(bid);
  };

  useEffect(() => {
    loadAll();
  }, [currentFolderId, batchId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [currentFolderId, batchId]);

  const openFolder = (folder) => {
    setFolderStack((prev) => [...prev, folder]);
  };

  const jumpToBreadcrumb = (index) => {
    // index === -1 means the batch root, i.e. an empty stack.
    setFolderStack((prev) => prev.slice(0, index + 1));
  };

  const handleCreateFolder = async () => {
    setNewFolderError('');
    if (!newFolderName.trim()) {
      setNewFolderError('Please enter a folder name');
      return;
    }
    setCreatingFolder(true);
    try {
      const res = await api.post('/study-materials/folders', {
        name: newFolderName.trim(),
        batchId,
        parentFolderId: currentFolderId,
      });
      if (res.data.success) {
        setNewFolderModalVisible(false);
        setNewFolderName('');
        fetchContents(batchId);
      }
    } catch (error) {
      console.error('Create folder error', error);
      setNewFolderError(error.response?.data?.message || 'Could not create the folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const uploadPickedFile = async (picked) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('folderId', currentFolderId);
      formData.append('batchId', batchId);
      formData.append('name', picked.name.replace(/\.pdf$/i, ''));

      if (Platform.OS === 'web') {
        // DocumentPicker on web hands back a blob:/data: URI — resolve it to a
        // real Blob the same way the photo-upload screens already do, rather
        // than the {uri,name,type} object (which only works via the native
        // bridge on iOS/Android).
        const response = await fetch(picked.uri);
        const blob = await response.blob();
        formData.append('file', blob, picked.name);
      } else {
        formData.append('file', { uri: picked.uri, name: picked.name, type: 'application/pdf' });
      }

      const res = await api.post('/study-materials/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        fetchContents(batchId);
      }
    } catch (error) {
      console.error('Upload PDF error', error);
      showMessage('Upload failed', error.response?.data?.message || 'Could not upload the PDF');
    } finally {
      setUploading(false);
    }
  };

  const handlePickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) return;
    uploadPickedFile(result.assets[0]);
  };

  const handleDeleteFolder = (folder) => {
    const doDelete = async () => {
      try {
        const res = await api.delete(`/study-materials/folders/${folder.id}`);
        if (res.data.success) {
          fetchContents(batchId);
        }
      } catch (error) {
        console.error('Delete folder error', error);
        showMessage('Error', error.response?.data?.message || 'Could not delete the folder');
      }
    };
    const msg = `Delete "${folder.name}" and everything inside it? This cannot be undone.`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert('Delete Folder', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleDeleteFile = (file) => {
    const doDelete = async () => {
      try {
        const res = await api.delete(`/study-materials/files/${file.id}`);
        if (res.data.success) {
          fetchContents(batchId);
        }
      } catch (error) {
        console.error('Delete file error', error);
        showMessage('Error', error.response?.data?.message || 'Could not delete the file');
      }
    };
    const msg = `Delete "${file.name}"?`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert('Delete File', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleOpenFile = async (file) => {
    // The endpoint is authenticated (it checks the requester can read this
    // file's batch), so it can't just be handed to the browser/OS as a bare
    // URL — the auth token has to ride along, same as every other api.get
    // call. Opening the resulting blob URL is what actually shows the PDF.
    try {
      const res = await api.get(`/study-materials/files/${file.id}/download`, {
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(res.data);
      if (Platform.OS === 'web') {
        window.open(blobUrl, '_blank');
      } else {
        Linking.openURL(blobUrl);
      }
    } catch (error) {
      console.error('Open file error', error);
      showMessage('Error', 'Could not open this file');
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderFolder = ({ item }) => (
    <Card style={styles.row}>
      <TouchableOpacity style={styles.rowMain} activeOpacity={0.7} onPress={() => openFolder(item)}>
        <Text style={styles.rowIcon}>📁</Text>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
      </TouchableOpacity>
      {isAdmin ? (
        <TouchableOpacity style={styles.deleteIconBtn} onPress={() => handleDeleteFolder(item)}>
          <Text style={styles.deleteIconText}>🗑️</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </Card>
  );

  const renderFile = ({ item }) => (
    <Card style={styles.row}>
      <TouchableOpacity style={styles.rowMain} activeOpacity={0.7} onPress={() => handleOpenFile(item)}>
        <Text style={styles.rowIcon}>📄</Text>
        <View style={styles.fileInfoCol}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.fileMeta}>{formatSize(item.fileSize)}</Text>
        </View>
      </TouchableOpacity>
      {isAdmin ? (
        <TouchableOpacity style={styles.deleteIconBtn} onPress={() => handleDeleteFile(item)}>
          <Text style={styles.deleteIconText}>🗑️</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.chevron}>⬇</Text>
      )}
    </Card>
  );

  // A single combined list — folders first, then files — so pull-to-refresh
  // and the empty state only have to be handled once.
  const combinedData = [
    ...folders.map((f) => ({ ...f, __type: 'folder' })),
    ...files.map((f) => ({ ...f, __type: 'file' })),
  ];

  return (
    <SafeAreaView style={[styles.safeArea, screenStyle]}>
      <View>
        <Header
          title={folderStack.length > 0 ? folderStack[folderStack.length - 1].name : batchName}
          // Opened from the admin's batch list, there's a stack screen underneath to
          // return to even at the batch root. Opened as the student's "Notes" tab,
          // there's no stack underneath it at all — a back arrow there would just be
          // a dead button, so it only appears once there's actually a folder to climb
          // out of.
          showBackButton={folderStack.length > 0 || Boolean(route.params?.batchId)}
          onBackPress={() =>
            folderStack.length > 0
              ? setFolderStack((prev) => prev.slice(0, -1))
              : navigation.goBack()
          }
        />
      </View>

      {/* Breadcrumb */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.breadcrumbBar}>
        <TouchableOpacity onPress={() => jumpToBreadcrumb(-1)}>
          <Text style={[styles.breadcrumbText, folderStack.length === 0 && styles.breadcrumbTextActive]}>
            {batchName}
          </Text>
        </TouchableOpacity>
        {folderStack.map((f, i) => (
          <View key={f.id} style={styles.breadcrumbSegment}>
            <Text style={styles.breadcrumbSep}>›</Text>
            <TouchableOpacity onPress={() => jumpToBreadcrumb(i)}>
              <Text
                style={[
                  styles.breadcrumbText,
                  i === folderStack.length - 1 && styles.breadcrumbTextActive,
                ]}
                numberOfLines={1}
              >
                {f.name}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {isAdmin && (
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={() => setNewFolderModalVisible(true)}
          >
            <Text style={styles.toolbarBtnText}>📁 New Folder</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolbarBtn, styles.toolbarBtnPrimary]}
            onPress={handlePickPdf}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <Text style={styles.toolbarBtnTextPrimary}>⬆️ Upload PDF</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={combinedData}
          keyExtractor={(item) => `${item.__type}-${item.id}`}
          renderItem={(props) =>
            props.item.__type === 'folder' ? renderFolder(props) : renderFile(props)
          }
          style={scrollStyle}
          contentContainerStyle={styles.listContainer}
          refreshControl={webRefreshControl(
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {isAdmin
                  ? 'Nothing here yet. Create a folder or upload a PDF to get started.'
                  : 'No study notes here yet.'}
              </Text>
            </View>
          }
        />
      )}

      {/* New Folder Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={newFolderModalVisible}
        onRequestClose={() => setNewFolderModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Folder</Text>
            <Text style={styles.modalSubtitle}>
              Inside: {folderStack.length > 0 ? folderStack[folderStack.length - 1].name : batchName}
            </Text>
            <Input
              label="Folder Name *"
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="e.g. Indian History"
              error={newFolderError}
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                type="secondary"
                onPress={() => {
                  setNewFolderModalVisible(false);
                  setNewFolderName('');
                  setNewFolderError('');
                }}
                style={styles.modalActionBtn}
              />
              <Button
                title="Create"
                onPress={handleCreateFolder}
                loading={creatingFolder}
                style={[styles.modalActionBtn, { marginLeft: 12 }]}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breadcrumbBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  breadcrumbSegment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbSep: {
    color: COLORS.textMuted,
    marginHorizontal: 4,
  },
  breadcrumbText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    maxWidth: 140,
  },
  breadcrumbTextActive: {
    color: COLORS.primaryLight,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: 8,
  },
  toolbarBtn: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
  },
  toolbarBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  toolbarBtnText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  toolbarBtnTextPrimary: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  listContainer: {
    padding: SPACING.md,
    paddingTop: 0,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  rowName: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    flexShrink: 1,
  },
  fileInfoCol: {
    flexShrink: 1,
  },
  fileMeta: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  chevron: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.lg,
    paddingHorizontal: 8,
  },
  deleteIconBtn: {
    padding: 8,
  },
  deleteIconText: {
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.sm,
    textAlign: 'center',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: SPACING.md,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.sizes.xs,
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 20,
  },
  modalActionBtn: {
    flex: 1,
  },
});

export default StudyMaterialsScreen;
