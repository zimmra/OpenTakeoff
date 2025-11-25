/**
 * Device Form Modal
 * Create/Edit device form with react-hook-form and zod validation
 */

import { useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@/components/ui/Dialog';
import { ColorPicker } from './ColorPicker';
import { IconPicker } from './IconPicker';
import { deviceFormSchema, type DeviceFormData } from './DeviceFormSchema';
import { useCreateDevice, useUpdateDevice } from '../hooks/useDevices';
import { getNextColor } from '@/utils/colors';
import type { Device } from '../types';

interface DeviceFormModalProps {
  projectId: string;
  device?: Device | null; // If provided, edit mode; otherwise create mode
  existingColors?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeviceFormModal({
  projectId,
  device,
  existingColors = [],
  open,
  onOpenChange,
  onSuccess,
}: DeviceFormModalProps) {
  const isEditMode = !!device;

  // Mutations
  const createMutation = useCreateDevice(projectId);
  const updateMutation = useUpdateDevice(projectId);
  
  const saveAndCreateNewRef = useRef(false);

  // Form setup
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DeviceFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(deviceFormSchema as any),
    defaultValues: {
      name: device?.name ?? '',
      description: device?.description ?? '',
      color: device?.color ?? getNextColor(existingColors),
      iconKey: device?.iconKey ?? '',
    },
  });

  // Reset form when device changes or modal opens
  useEffect(() => {
    if (open) {
      reset({
        name: device?.name ?? '',
        description: device?.description ?? '',
        color: device?.color ?? getNextColor(existingColors),
        iconKey: device?.iconKey ?? '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- existingColors changes frequently but we only want to initialize once
  }, [device, open, reset]);

  const onSubmit = async (data: DeviceFormData) => {
    try {
      if (isEditMode) {
        // Update existing device
        await updateMutation.mutateAsync({
          deviceId: device.id,
          input: {
            name: data.name,
            description: data.description ?? null,
            color: data.color ?? null,
            iconKey: data.iconKey ?? null,
          },
        });
      } else {
        // Create new device
        await createMutation.mutateAsync({
          name: data.name,
          ...(data.description && { description: data.description }),
          ...(data.color && { color: data.color }),
          ...(data.iconKey && { iconKey: data.iconKey }),
        });
      }

      if (saveAndCreateNewRef.current && !isEditMode) {
        // Reset form for new entry but keep modal open
        const nextColor = getNextColor([...existingColors, data.color ?? null]);
        reset({
          name: '',
          description: '',
          color: nextColor,
          iconKey: '',
        });
        saveAndCreateNewRef.current = false;
        onSuccess?.();
        
        // Focus name input if possible, but react-hook-form handles focus usually.
        // We could use setFocus if we exposed it, but reset might be enough.
      } else {
        // Success - close modal and reset form
        onOpenChange(false);
        reset();
        onSuccess?.();
      }
    } catch (error) {
      // Error is handled by mutation hooks (optimistic rollback)
      console.error('Failed to save device:', error);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditMode ? 'Edit Device' : 'Create Device'}
      description={
        isEditMode
          ? 'Update the device information below'
          : 'Add a new device to your project catalog'
      }
      footer={
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          {!isEditMode && (
            <button
              type="submit"
              form="device-form"
              disabled={isSubmitting}
              onClick={() => {
                saveAndCreateNewRef.current = true;
              }}
              className="px-4 py-2 text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save & New
            </button>
          )}
          <button
            type="submit"
            form="device-form"
            disabled={isSubmitting}
            onClick={() => {
              saveAndCreateNewRef.current = false;
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
          </button>
        </div>
      }
    >
      <form id="device-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
            Device Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            {...register('name')}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              errors.name ? 'border-red-300' : 'border-slate-300'
            }`}
            placeholder="e.g., LED Light Fixture"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && (
            <p id="name-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Description field */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            {...register('description')}
            rows={3}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none ${
              errors.description ? 'border-red-300' : 'border-slate-300'
            }`}
            placeholder="Optional description or notes about this device"
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? 'description-error' : undefined}
          />
          {errors.description && (
            <p id="description-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Color picker */}
        <Controller
          name="color"
          control={control}
          render={({ field }) => (
            <ColorPicker
              value={field.value ?? ''}
              onChange={field.onChange}
              label="Color"
              {...(errors.color?.message && { error: errors.color.message })}
            />
          )}
        />

        {/* Icon picker */}
        <Controller
          name="iconKey"
          control={control}
          render={({ field }) => (
            <IconPicker
              value={field.value ?? ''}
              onChange={field.onChange}
              label="Icon"
              {...(errors.iconKey?.message && { error: errors.iconKey.message })}
            />
          )}
        />
      </form>
    </Dialog>
  );
}
