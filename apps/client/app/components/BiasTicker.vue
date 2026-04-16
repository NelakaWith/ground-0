<script setup lang="ts">
interface TickerItem {
  id: string;
  title: string;
  providerId: string;
  adjectiveCount: number;
  adjectives: string[];
  sentiment: number;
}

const { data: tickerItems } = await useFetch<TickerItem[]>(
  '/api/articles/bias-ticker',
  {
    baseURL: 'http://localhost:3000',
  },
);

const getBiasColor = (count: number): 'error' | 'warning' | 'success' => {
  if (count > 5) return 'error';
  if (count > 2) return 'warning';
  return 'success';
};
</script>

<template>
  <UCard class="h-full overflow-hidden flex flex-col">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <UIcon
            name="i-lucide-zap"
            class="text-amber-500"
          />
          Bias Ticker
        </h3>
        <UBadge
          variant="subtle"
          color="primary"
        >
          Live
        </UBadge>
      </div>
    </template>

    <div class="flex-1 overflow-y-auto space-y-4 p-1">
      <div
        v-for="item in tickerItems"
        :key="item.id"
        class="group p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all cursor-pointer"
      >
        <div class="flex justify-between items-start gap-2 mb-2">
          <span
            class="text-xs font-medium uppercase tracking-wider text-neutral-500"
          >
            {{ item.providerId }}
          </span>
          <UBadge
            :color="getBiasColor(item.adjectiveCount)"
            variant="soft"
            size="xs"
          >
            {{ item.adjectiveCount }} Intensity
          </UBadge>
        </div>
        <p
          class="text-sm font-medium line-clamp-2 mb-2 group-hover:text-primary transition-colors"
        >
          {{ item.title }}
        </p>
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-for="adj in item.adjectives.slice(0, 3)"
            :key="adj"
            variant="outline"
            size="xs"
            class="opacity-70"
          >
            {{ adj }}
          </UBadge>
        </div>
      </div>
    </div>
  </UCard>
</template>
