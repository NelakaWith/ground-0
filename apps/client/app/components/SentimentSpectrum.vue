<script setup lang="ts">
interface Article {
  id: string;
  providerId: string;
  sentimentScore: number;
  chargedAdjectives: string;
}

const props = defineProps<{
  articles: Article[];
}>();

const getSentimentColor = (score: number) => {
  if (score > 0.3) return 'text-green-500';
  if (score < -0.3) return 'text-red-500';
  return 'text-amber-500';
};

const getSentimentLabel = (score: number) => {
  if (score > 0.6) return 'Highly Positive';
  if (score > 0.1) return 'Positive';
  if (score > -0.1) return 'Neutral';
  if (score > -0.6) return 'Negative';
  return 'Highly Negative';
};
</script>

<template>
  <div class="space-y-6">
    <div
      v-for="article in props.articles"
      :key="article.id"
      class="relative"
    >
      <div class="flex justify-between items-center mb-1">
        <span class="text-sm font-semibold">{{ article.providerId }}</span>
        <span
          :class="[
            'text-xs font-bold',
            getSentimentColor(article.sentimentScore),
          ]"
        >
          {{ getSentimentLabel(article.sentimentScore) }} ({{
            article.sentimentScore.toFixed(2)
          }})
        </span>
      </div>

      <!-- Spectrum Bar -->
      <div
        class="h-3 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden relative"
      >
        <!-- Center Pointer -->
        <div
          class="absolute left-1/2 top-0 bottom-0 w-0.5 bg-neutral-300 dark:bg-neutral-600 z-10"
        />

        <!-- Value Bar -->
        <div
          class="absolute top-0 bottom-0 h-full transition-all duration-1000 ease-out"
          :class="[
            article.sentimentScore > 0 ? 'bg-green-500/50' : 'bg-red-500/50',
          ]"
          :style="{
            left:
              article.sentimentScore > 0
                ? '50%'
                : `${50 + article.sentimentScore * 50}%`,
            width: `${Math.abs(article.sentimentScore * 50)}%`,
          }"
        />

        <!-- Value Cap -->
        <div
          class="absolute top-0 bottom-0 w-1 bg-current z-20"
          :class="getSentimentColor(article.sentimentScore)"
          :style="{
            left: `${50 + article.sentimentScore * 50}%`,
          }"
        />
      </div>

      <!-- Adjectives Preview -->
      <div class="mt-2 text-xs text-neutral-500 line-clamp-1 italic">
        "{{ JSON.parse(article.chargedAdjectives || '[]').join(', ') }}"
      </div>
    </div>
  </div>
</template>
