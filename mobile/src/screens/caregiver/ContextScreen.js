import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { colors } from '../../constants/colors';
import { getContext, updateContext } from '../../services/api';

function SectionHeader({ title, icon }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconBadge}>
        <Text style={styles.sectionIcon}>{icon}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function ListItem({ value, onRemove, index }) {
  return (
    <View style={styles.listItem}>
      <Text style={styles.listItemText} numberOfLines={2}>
        {value}
      </Text>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => onRemove(index)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.removeButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function AddItemRow({ placeholder, onAdd }) {
  const [value, setValue] = useState('');

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
    }
  };

  return (
    <View style={styles.addRow}>
      <TextInput
        style={styles.addInput}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onSubmitEditing={handleAdd}
        returnKeyType="done"
      />
      <TouchableOpacity
        style={[styles.addButton, !value.trim() && styles.addButtonDisabled]}
        onPress={handleAdd}
        disabled={!value.trim()}
      >
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

function FamilyMemberRow({ member, onRemove, index }) {
  return (
    <View style={styles.listItem}>
      <View style={styles.familyMemberContent}>
        <Text style={styles.familyName}>{member.name}</Text>
        <Text style={styles.familyRelation}>{member.relation}</Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => onRemove(index)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.removeButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function AddFamilyMemberRow({ onAdd }) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');

  const handleAdd = () => {
    if (name.trim() && relation.trim()) {
      onAdd({ name: name.trim(), relation: relation.trim() });
      setName('');
      setRelation('');
    }
  };

  return (
    <View style={styles.addFamilyRow}>
      <View style={styles.addFamilyInputs}>
        <TextInput
          style={[styles.addInput, styles.addFamilyNameInput]}
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={colors.textMuted}
          returnKeyType="next"
        />
        <TextInput
          style={[styles.addInput, styles.addFamilyRelationInput]}
          value={relation}
          onChangeText={setRelation}
          placeholder="Relation"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
      </View>
      <TouchableOpacity
        style={[
          styles.addButton,
          (!name.trim() || !relation.trim()) && styles.addButtonDisabled,
        ]}
        onPress={handleAdd}
        disabled={!name.trim() || !relation.trim()}
      >
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

const DEFAULT_CONTEXT = {
  name: '',
  age: '',
  dailyRoutine: '',
  medications: [],
  familyMembers: [],
  baselineRules: '',
  notes: '',
  favoriteSong: '',
};

export default function ContextScreen() {
  const { patientId } = useApp();
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const originalContextRef = useRef(null);

  useEffect(() => {
    loadContext();
  }, [patientId]);

  const loadContext = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getContext(patientId);
      const normalized = {
        name: data.name || '',
        age: data.age ? String(data.age) : '',
        dailyRoutine: data.dailyRoutine || data.daily_routine || '',
        medications: Array.isArray(data.medications)
          ? data.medications.map((m) =>
              typeof m === 'string' ? m : [m.name, m.dosage, m.time].filter(Boolean).join(' ')
            )
          : [],
        familyMembers: Array.isArray(data.family) ? data.family : [],
        baselineRules: data.baselineRules || data.baseline_rules || '',
        notes: data.notes || '',
        favoriteSong: data.favoriteSong || '',
      };
      setContext(normalized);
      originalContextRef.current = JSON.stringify(normalized);
      setIsDirty(false);
    } catch (err) {
      setError('Could not load patient context. Check your connection.');
      console.error('ContextScreen load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setContext((prev) => {
      const updated = { ...prev, [field]: value };
      setIsDirty(JSON.stringify(updated) !== originalContextRef.current);
      return updated;
    });
    setSaveSuccess(false);
  };

  const handleAddMedication = (med) => {
    const updated = [...context.medications, med];
    updateField('medications', updated);
  };

  const handleRemoveMedication = (index) => {
    const updated = context.medications.filter((_, i) => i !== index);
    updateField('medications', updated);
  };

  const handleAddFamilyMember = (member) => {
    const updated = [...context.familyMembers, member];
    updateField('familyMembers', updated);
  };

  const handleRemoveFamilyMember = (index) => {
    const updated = context.familyMembers.filter((_, i) => i !== index);
    updateField('familyMembers', updated);
  };

  const handleSave = async () => {
    if (!isDirty) return;

    try {
      setSaving(true);
      setError(null);
      await updateContext(patientId, {
        ...context,
        family: context.familyMembers,
        age: context.age ? parseInt(context.age, 10) : undefined,
        favoriteSong: context.favoriteSong || null,
      });
      originalContextRef.current = JSON.stringify(context);
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Could not save changes. Please try again.');
      Alert.alert('Save Failed', 'Could not save changes. Please try again.');
      console.error('ContextScreen save error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading patient profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Dirty indicator banner */}
        {isDirty && (
          <View style={styles.dirtyBanner}>
            <Text style={styles.dirtyBannerText}>Unsaved changes</Text>
          </View>
        )}

        {saveSuccess && (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>✓ Saved successfully</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Basic Info */}
          <SectionHeader title="Basic Information" icon="👤" />

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={context.name}
            onChangeText={(v) => updateField('name', v)}
            placeholder="Patient's full name"
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
          />

          <Text style={styles.label}>Age</Text>
          <TextInput
            style={styles.input}
            value={context.age}
            onChangeText={(v) => updateField('age', v)}
            placeholder="e.g. 78"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            returnKeyType="next"
          />

          {/* Daily Routine */}
          <SectionHeader title="Daily Routine" icon="🕐" />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={context.dailyRoutine}
            onChangeText={(v) => updateField('dailyRoutine', v)}
            placeholder="Describe the patient's typical daily routine..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          {/* Medications */}
          <SectionHeader title="Medications" icon="💊" />
          {context.medications.length > 0 ? (
            context.medications.map((med, index) => (
              <ListItem
                key={index}
                value={med}
                index={index}
                onRemove={handleRemoveMedication}
              />
            ))
          ) : (
            <Text style={styles.emptyListText}>No medications added</Text>
          )}
          <AddItemRow
            placeholder="Add a medication (e.g. Aricept 10mg daily)"
            onAdd={handleAddMedication}
          />

          {/* Family Members */}
          <SectionHeader title="Family Members" icon="👨‍👩‍👧" />
          {context.familyMembers.length > 0 ? (
            context.familyMembers.map((member, index) => (
              <FamilyMemberRow
                key={index}
                member={member}
                index={index}
                onRemove={handleRemoveFamilyMember}
              />
            ))
          ) : (
            <Text style={styles.emptyListText}>No family members added</Text>
          )}
          <AddFamilyMemberRow onAdd={handleAddFamilyMember} />

          {/* Baseline Rules */}
          <SectionHeader title="Baseline Rules" icon="📋" />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={context.baselineRules}
            onChangeText={(v) => updateField('baselineRules', v)}
            placeholder="Rules for the AI assistant (e.g. always remind them to drink water, never mention certain topics)..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          {/* Favorite Song */}
          <SectionHeader title="Favorite Song" icon="🎵" />
          <TextInput
            style={styles.input}
            value={context.favoriteSong}
            onChangeText={(v) => updateField('favoriteSong', v)}
            placeholder="e.g. Yesterday by The Beatles"
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
          />
          <Text style={styles.songHint}>
            Played automatically when the patient triggers an SOS alert to keep them calm while waiting for help.
          </Text>

          {/* Notes */}
          <SectionHeader title="Additional Notes" icon="📝" />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={context.notes}
            onChangeText={(v) => updateField('notes', v)}
            placeholder="Any additional notes for the AI assistant..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isDirty || saving}
            activeOpacity={0.85}
            style={[styles.saveButtonWrapper, (!isDirty || saving) && styles.saveButtonDisabledWrapper]}
          >
            {isDirty && !saving ? (
              <LinearGradient
                colors={colors.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.saveButton, !isDirty ? styles.saveButtonSaved : styles.saveButtonSaving]}>
                {saving ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={[styles.saveButtonText, styles.saveButtonTextSaved]}>✓ All Changes Saved</Text>
                )}
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 17,
    color: colors.textMuted,
  },
  dirtyBanner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  dirtyBannerText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  successBannerText: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: colors.dangerLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  errorBannerText: {
    fontSize: 14,
    color: '#991B1B',
    fontWeight: '500',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sectionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.text,
    marginBottom: 4,
  },
  textArea: {
    minHeight: 110,
    paddingTop: 12,
  },
  emptyListText: {
    fontSize: 15,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 8,
    paddingLeft: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '700',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: colors.border,
  },
  addButtonText: {
    fontSize: 15,
    color: colors.white,
    fontWeight: '700',
  },
  addFamilyRow: {
    gap: 8,
    marginBottom: 8,
  },
  addFamilyInputs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  addFamilyNameInput: {
    flex: 2,
  },
  addFamilyRelationInput: {
    flex: 1,
  },
  familyMemberContent: {
    flex: 1,
  },
  familyName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  familyRelation: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  saveButtonWrapper: {
    marginTop: 28,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButtonDisabledWrapper: {
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveButtonSaved: {
    backgroundColor: colors.border,
  },
  saveButtonSaving: {
    backgroundColor: colors.primary,
    opacity: 0.8,
  },
  saveButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.3,
  },
  saveButtonTextSaved: {
    color: colors.textMuted,
    fontSize: 17,
    fontWeight: '600',
  },
  songHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
    marginTop: 2,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 40,
  },
});
